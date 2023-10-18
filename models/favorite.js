const mongoose = require('mongoose');


const favoriteSchema = new mongoose.Schema({
    image : String,
    title : String,
    description : String,
    user : String,
    date : {
        type: Date,
        default: Date.now()
    }
});


module.exports = mongoose.model('Favorite', favoriteSchema);