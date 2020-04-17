const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: 'Please enter a store name!',
    },
    slug: String,
    description: {
      type: String,
      trim: true,
    },
    tags: [String],
    created: {
      type: Date,
      default: Date.now,
    },
    location: {
      type: {
        type: String,
        default: 'Point',
      },
      coordinates: [
        {
          type: Number,
          required: 'You must supply coordinates',
        },
      ],
      address: {
        type: String,
        required: 'You must supply an address',
      },
    },
    photo: String,
    author: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: 'You must supply an author',
    },
  },
  {
    toJson: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// define our index's
storeSchema.index({
  name: 'text',
  description: 'text',
});

storeSchema.index({ location: '2dsphere' });

storeSchema.pre('save', async function (next) {
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop it from running
  }
  this.slug = slug(this.name);
  // find other stores with that slug
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if (storesWithSlug) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  next();
});

storeSchema.statics.getTagsList = function () {
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};

storeSchema.statics.getTopStores = function () {
  return this.aggregate([
    //From lesson 39, learn node
    // 1. Loop up stores and pupulate reviews
    // from below is name of DB as represented in mongoDB compass
    // as below is the name query shows up with
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'store',
        as: 'reviews',
      },
    },
    // 2. filter for only items that have 2 or more reviews
    // reviews.1 below is like reviews[1] in js
    { $match: { 'reviews.1': { $exists: true } } },
    // 3. Add the avg review field
    // need to add back in fields when using prject
    {
      $project: {
        photo: '$$ROOT.photo',
        name: '$$ROOT.name',
        reviews: '$$ROOT.reviews',
        slug: '$$ROOT.slug',
        averageRating: { $avg: '$reviews.rating' },
      },
    },
    // 4. Sort by the new field, avg review, highest first
    { $sort: { averageRating: -1 } },
    // 5. limit to 10
    { $limit: 10 },
  ]);
};

// find reviews where the stores _id property === reviews store propert
// Virtual is a mongoose specific function, not mongo
storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store?
  foreignField: 'store', // which field on teh review?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);
