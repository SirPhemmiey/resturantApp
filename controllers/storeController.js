const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if (isPhoto) {
            next(null, true)
        } else {
            next({
                message: 'That filetype isn\'t allowed'
            }, false)
        }
    }
};

exports.homePage = (req, res) => {
    res.render('index');
};

exports.addStore = (req, res) => {
    res.render('editStore', {
        title: 'Add store'
    });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
    //if there is not new file to request
    if (!req.file) {
        next(); //skip
        return;
    }
    //onsole.log(req.file);
    const extension = req.file.mimetype.split("/")[1];
    req.body.photo = `${uuid.v4()}.${extension}`;
    //now we resize
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(400, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`);
    next();
};

exports.createStore = async (req, res) => {
    // const store = new Store(req.body);
    // await store.save();
    req.body.author = req.user._id;
    const store = await (new Store(req.body).save());
    req.flash('success', `Successfully created ${store.name}`);
    res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
    const page = req.params.page || 1;
    const limit = 4;
    const skip = (page * limit) - limit;
    //Query the DB
    const storesPromise = Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc'});

    const countPromise = Store.count();

    const [stores, count] = await Promise.all([storesPromise, countPromise]);
    const pages = Math.ceil(count / limit);

    //this will help users bookmark the pages if they want
    if (!stores.length && skip) {
        req.flash("info", `Hey! You asked for page ${page}. But it doesn't exit, so i put you on page ${pages}`);
        res.redirect(`/stores/page/${pages}`);
        return;
    }
    res.render('stores', {
        stores, count, pages, page
    });
};

const confirmOwner = (store, user) => {
    if (!store.author.equals(user._id)) {
        throw Error("You must own a store")
    }
};

exports.editStore = async (req, res) => {
    //find the store given the ID
    const store = await Store.findOne({
        _id: req.params.id
    });

    confirmOwner(store, req.user);

    res.render('editStore', {
        title: `Edit ${store.name}`,
        store
    })
};

exports.updateStore = async (req, res) => {
    //req.body.location.type = 'Point';
    const store = await Store.findOneAndUpdate({
        _id: req.params.id
    }, req.body, {
        new: true,
        runValidators: true
    }).exec();
    req.flash("success", "successfully updated");
    res.redirect(`/store/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({
        slug: req.params.slug
    }).populate('author reviews');
    if (!store) {
        return next();
    }
    res.render("store", {
        store,
        title: store.name
    });
};

exports.getStoreByTag = async (req, res) => {
    //normally we would want to query the db with another await again, but that makes the process synchronous. They don't have to wait for each other.
    //    const tags = await Store.getTagList();
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true};
    const tagsPromise = await Store.getTagList();
    const storesPromise = Store.find({tags: tagQuery})
    const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
    res.render("tag", {
        tags,
        title: 'Tags',
        tag,
        stores
    });
};

exports.searchStores = async (req, res) => {
    const stores = await Store.find({
        $text: {
            $search: req.query.q
        }
    }, {
        score: { $meta: 'textScore'}
    })
    .sort({
        score: { $meta: 'textScore'}
    })
    .limit(5);
    res.json(stores);
};

exports.mapStores = async (req, res) => {
    const coord = [req.query.lng, req.query.lat].map(parseFloat)
    const q = {
        location: {
            $near: {
              $geometry: {
                  type: 'Point',
                  coordinates: coord
              },
              $maxDistance: 10000 //10km
            }
        }
    };
    const stores = await Store.find(q).select("photo name");
    res.json(stores);
};

exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map(obj => obj.toString());
    const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
    const user = await User.findByIdAndUpdate(req.user._id, { [operator]: { hearts: req.params.id}}, { new: true })

    res.json(user);
};

exports.getHearts = async (req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts}
    })
    res.render("stores", {title: "Heart stores", stores})
};

exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores();
    res.render('topStores', {stores, title: 'Top Stores'});
};