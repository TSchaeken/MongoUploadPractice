const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const gridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
const port = 8080;

const app = express();

//I guess this is middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

const mongoURI = 'mongodb://localhost/UploadTrial';

const connection = mongoose.createConnection(mongoURI);

let gfs;

connection.once('open', () => {
  gfs = Grid(connection.db, mongoose.mongo);
  gfs.collection('uploads');
});

const storage = new gridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});

const upload = multer({ storage });

//@route GET /
//@desc Loads a form
app.get('/', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    //checks for files
    if (!files || files.length === 0) {
      res.render('index', { files: false });
    } else {
      files.map(file => {
        if (file.contentType === 'image/jpeg' || file.contentType === 'application/pdf') {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.render('index', { files: files });
    }
  });
});

//@route POST /upload
//@desc uploads file to mongodb

app.post('/upload', upload.single('file'), (req, res) => {
  // res.json({file: req.file})
  res.redirect('/');
});

//@route GET /files
//@desc Display all files in JSON
app.get('/files', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    //checks for files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }
    return res.json(files);
  });
});

//@route GET /files/:filename
//@desc Display single file in JSON
app.get('/files/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    return res.json(file);
  });
});

//@route GET /image/:filename
//@desc Display image
app.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    //check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'application/pdf') {
      //read output stream
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      return res.status(404).json({
        err: 'Not an image or a pdf'
      });
    }
  });
});

// @route DELETE /files/:_id
// @desc delete file
app.delete('/files/:id', (req, res) => {
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if (err) {
      return res.status(404).json({ err: err });
    }

    res.redirect('/');
  });
});

app.listen(port, () => console.log(`Server started on ${port}`));
