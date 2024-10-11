const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const User = require('./models/User');
const Post = require('./models/Post');
const app = express();

// Constants from environment variables
const salt = bcrypt.genSaltSync(10);
const secret = process.env.JWT_SECRET || 'asdfe45we45w345wegw345werjktjwertkjrt5rtyt'; // JWT secret
const port = process.env.PORT || 4000; // Dynamic port for Heroku
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://gci:Collin@gci.fc2y1.mongodb.net/?retryWrites=true&w=majority&appName=gci'; // Mongo URI

// Allow multiple origins for CORS
const allowedOrigins = [
  'https://gci-kutus-web.vercel.app',
  'https://gci-kutus.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  credentials: true,
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

// MongoDB connection
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// File Upload Middleware
const uploadMiddleware = multer({ dest: 'uploads/' });

// Register Route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: 'Error creating user', error: e });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  if (!userDoc) {
    return res.status(400).json({ message: 'User not found' });
  }
  
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) {
        console.error('Error signing token:', err);
        return res.status(500).json({ message: 'Error signing token' });
      }
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',  // Secure cookie for production
        sameSite: 'None',  // To allow cross-origin requests
      }).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json({ message: 'Wrong credentials' });
  }
});

// Profile Route
app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ message: 'Token is missing' });
  }

  jwt.verify(token, secret, {}, (err, info) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ message: 'Token verification failed', error: err.message });
    }
    res.json(info);
  });
});

// Logout Route
app.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None',
  }).json('ok');
});

// Create Post Route
app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path + '.' + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: info.id,
    });
    res.json(postDoc);
  });
});

// Update Post Route
app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json({ message: 'You are not the author' });
    }
    await postDoc.update({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });
});

// Get All Posts Route
app.get('/post', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', ['username'])
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Error fetching posts', error: error.message });
  }
});

// Get Single Post by ID
app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const postDoc = await Post.findById(id).populate('author', ['username']);
    if (!postDoc) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json(postDoc);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Error fetching post', error: error.message });
  }
});

// Start the Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});






// const express = require('express');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const multer = require('multer');
// const fs = require('fs');
// const cookieParser = require('cookie-parser');
// const User = require('./models/User');
// const Post = require('./models/Post');
// const app = express();

// // Constants from environment variables
// const salt = bcrypt.genSaltSync(10);
// const secret = process.env.JWT_SECRET || 'asdfe45we45w345wegw345werjktjwertkj'; // Using environment variable for JWT secret
// const port = process.env.PORT || 4000; // Dynamic port for Heroku
// const mongoUri = process.env.MONGO_URI || 'mongodb+srv://gci:Collin@gci.fc2y1.mongodb.net/?retryWrites=true&w=majority&appName=gci'; // Mongo URI from environment variables

// // Allow multiple origins for CORS
// const allowedOrigins = [
//   'https://gci-kutus-web.vercel.app',
//   'https://gci-kutus.vercel.app',
//   'http://localhost:3000'
// ];

// app.use(cors({
//   credentials: true,
//   origin: function (origin, callback) {
//     if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
//       callback(null, origin);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   }
// }));

// // Middleware
// app.use(express.json());
// app.use(cookieParser());
// app.use('/uploads', express.static(__dirname + '/uploads'));

// // MongoDB connection
// mongoose.connect(mongoUri, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log('MongoDB connected'))
//   .catch(err => console.error('MongoDB connection error:', err));

// // File Upload Middleware
// const uploadMiddleware = multer({ dest: 'uploads/' });

// // Register Route
// app.post('/register', async (req, res) => {
//   const { username, password } = req.body;
//   try {
//     const userDoc = await User.create({
//       username,
//       password: bcrypt.hashSync(password, salt),
//     });
//     res.json(userDoc);
//   } catch (e) {
//     console.error(e);
//     res.status(400).json(e);
//   }
// });

// // Login Route
// app.post('/login', async (req, res) => {
//   const { username, password } = req.body;
//   const userDoc = await User.findOne({ username });
//   const passOk = bcrypt.compareSync(password, userDoc.password);
//   if (passOk) {
//     jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
//       if (err) throw err;
//       res.cookie('token', token, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',  // Secure cookie for production
//         sameSite: 'None',  // To allow cross-origin requests
//       }).json({
//         id: userDoc._id,
//         username,
//       });
//     });
//   } else {
//     res.status(400).json('wrong credentials');
//   }
// });

// // Profile Route
// app.get('/profile', (req, res) => {
//   try {
//     const { token } = req.cookies;
//     if (!token) {
//       return res.status(401).json({ message: 'Token is missing' });
//     }

//     jwt.verify(token, secret, {}, (err, info) => {
//       if (err) {
//         console.error('Token verification failed:', err);
//         return res.status(401).json({ message: 'Token verification failed', error: err.message });
//       }
//       res.json(info);
//     });
//   } catch (error) {
//     console.error('Server error:', error);
//     res.status(500).json({ message: 'Internal Server Error', error: error.message });
//   }
// });

// // Logout Route
// app.post('/logout', (req, res) => {
//   res.cookie('token', '', {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: 'None',
//   }).json('ok');
// });

// // Create Post Route
// app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
//   const { originalname, path } = req.file;
//   const parts = originalname.split('.');
//   const ext = parts[parts.length - 1];
//   const newPath = path + '.' + ext;
//   fs.renameSync(path, newPath);

//   const { token } = req.cookies;
//   jwt.verify(token, secret, {}, async (err, info) => {
//     if (err) throw err;
//     const { title, summary, content } = req.body;
//     const postDoc = await Post.create({
//       title,
//       summary,
//       content,
//       cover: newPath,
//       author: info.id,
//     });
//     res.json(postDoc);
//   });
// });

// // Update Post Route
// app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
//   let newPath = null;
//   if (req.file) {
//     const { originalname, path } = req.file;
//     const parts = originalname.split('.');
//     const ext = parts[parts.length - 1];
//     newPath = path + '.' + ext;
//     fs.renameSync(path, newPath);
//   }

//   const { token } = req.cookies;
//   jwt.verify(token, secret, {}, async (err, info) => {
//     if (err) throw err;
//     const { id, title, summary, content } = req.body;
//     const postDoc = await Post.findById(id);
//     const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
//     if (!isAuthor) {
//       return res.status(400).json('you are not the author');
//     }
//     await postDoc.update({
//       title,
//       summary,
//       content,
//       cover: newPath ? newPath : postDoc.cover,
//     });

//     res.json(postDoc);
//   });
// });

// // Get All Posts Route
// app.get('/post', async (req, res) => {
//   res.setHeader('Access-Control-Allow-Origin', 'https://gci-kutus-web.vercel.app'); // Ensure this matches your frontend's origin
//   res.json(
//     await Post.find()
//       .populate('author', ['username'])
//       .sort({ createdAt: -1 })
//       .limit(20)
//   );
// });

// // app.get('/post', async (req, res) => {
// //   res.json(
// //     await Post.find()
// //       .populate('author', ['username'])
// //       .sort({ createdAt: -1 })
// //       .limit(20)
// //   );
// // });

// // Get Single Post by ID
// app.get('/post/:id', async (req, res) => {
//   const { id } = req.params;
//   const postDoc = await Post.findById(id).populate('author', ['username']);
//   res.json(postDoc);
// });

// // Start the Server
// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });


// const express = require('express');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const multer = require('multer');
// const fs = require('fs');
// const cookieParser = require('cookie-parser');
// const User = require('./models/User');
// const Post = require('./models/Post');
// const app = express();

// // Constants from environment variables
// const salt = bcrypt.genSaltSync(10);
// const secret = process.env.JWT_SECRET || 'asdfe45we45w345wegw345werjktjwertkj'; // Using environment variable for JWT secret
// const port = process.env.PORT || 4000; // Dynamic port for Heroku
// const mongoUri = process.env.MONGO_URI || 'mongodb+srv://gci:Collin@gci.fc2y1.mongodb.net/?retryWrites=true&w=majority&appName=gci'; // Mongo URI from environment variables

// // Middleware
// app.use(cors({
//   credentials: true,
//   origin: process.env.NODE_ENV === 'production' ? 'https://gci-kutus-web.vercel.app' : 'http://localhost:3000'
// }));
// app.use(express.json());
// app.use(cookieParser());
// app.use('/uploads', express.static(__dirname + '/uploads'));

// // MongoDB connection
// mongoose.connect(mongoUri, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log('MongoDB connected'))
//   .catch(err => console.error('MongoDB connection error:', err));

// // File Upload Middleware
// const uploadMiddleware = multer({ dest: 'uploads/' });

// // Register Route
// app.post('/register', async (req, res) => {
//   const { username, password } = req.body;
//   try {
//     const userDoc = await User.create({
//       username,
//       password: bcrypt.hashSync(password, salt),
//     });
//     res.json(userDoc);
//   } catch (e) {
//     console.error(e);
//     res.status(400).json(e);
//   }
// });

// // Login Route
// app.post('/login', async (req, res) => {
//   const { username, password } = req.body;
//   const userDoc = await User.findOne({ username });
//   const passOk = bcrypt.compareSync(password, userDoc.password);
//   if (passOk) {
//     jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
//       if (err) throw err;
//       res.cookie('token', token, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',  // Secure cookie for production
//         sameSite: 'None',  // To allow cross-origin requests
//       }).json({
//         id: userDoc._id,
//         username,
//       });
//     });
//   } else {
//     res.status(400).json('wrong credentials');
//   }
// });

// // Profile Route
// app.get('/profile', (req, res) => {
//   try {
//     const { token } = req.cookies;
//     if (!token) {
//       return res.status(401).json({ message: 'Token is missing' });
//     }

//     jwt.verify(token, secret, {}, (err, info) => {
//       if (err) {
//         console.error('Token verification failed:', err);
//         return res.status(401).json({ message: 'Token verification failed', error: err.message });
//       }
//       res.json(info);
//     });
//   } catch (error) {
//     console.error('Server error:', error);
//     res.status(500).json({ message: 'Internal Server Error', error: error.message });
//   }
// });



// // app.get('/profile', (req, res) => {
// //   const { token } = req.cookies;
// //   jwt.verify(token, secret, {}, (err, info) => {
// //     if (err) throw err;
// //     res.json(info);
// //   });
// // });

// // Logout Route
// app.post('/logout', (req, res) => {
//   res.cookie('token', '', {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: 'None',
//   }).json('ok');
// });

// // Create Post Route
// app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
//   const { originalname, path } = req.file;
//   const parts = originalname.split('.');
//   const ext = parts[parts.length - 1];
//   const newPath = path + '.' + ext;
//   fs.renameSync(path, newPath);

//   const { token } = req.cookies;
//   jwt.verify(token, secret, {}, async (err, info) => {
//     if (err) throw err;
//     const { title, summary, content } = req.body;
//     const postDoc = await Post.create({
//       title,
//       summary,
//       content,
//       cover: newPath,
//       author: info.id,
//     });
//     res.json(postDoc);
//   });
// });

// // Update Post Route
// app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
//   let newPath = null;
//   if (req.file) {
//     const { originalname, path } = req.file;
//     const parts = originalname.split('.');
//     const ext = parts[parts.length - 1];
//     newPath = path + '.' + ext;
//     fs.renameSync(path, newPath);
//   }

//   const { token } = req.cookies;
//   jwt.verify(token, secret, {}, async (err, info) => {
//     if (err) throw err;
//     const { id, title, summary, content } = req.body;
//     const postDoc = await Post.findById(id);
//     const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
//     if (!isAuthor) {
//       return res.status(400).json('you are not the author');
//     }
//     await postDoc.update({
//       title,
//       summary,
//       content,
//       cover: newPath ? newPath : postDoc.cover,
//     });

//     res.json(postDoc);
//   });
// });

// // Get All Posts Route
// app.get('/post', async (req, res) => {
//   res.json(
//     await Post.find()
//       .populate('author', ['username'])
//       .sort({ createdAt: -1 })
//       .limit(20)
//   );
// });

// // Get Single Post by ID
// app.get('/post/:id', async (req, res) => {
//   const { id } = req.params;
//   const postDoc = await Post.findById(id).populate('author', ['username']);
//   res.json(postDoc);
// });

// // Start the Server
// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });


// const express = require('express');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const multer = require('multer');
// const fs = require('fs');
// const cookieParser = require('cookie-parser');
// const User = require('./models/User');
// const Post = require('./models/Post');
// const app = express();

// // Constants from environment variables
// const salt = bcrypt.genSaltSync(10);
// const secret = process.env.JWT_SECRET || 'asdfe45we45w345wegw345werjktjwertkj'; // Using environment variable for JWT secret
// const port = process.env.PORT || 4000; // Dynamic port for Heroku
// const mongoUri = process.env.MONGO_URI || 'mongodb+srv://gci:Collin@gci.fc2y1.mongodb.net/?retryWrites=true&w=majority&appName=gci'; // Mongo URI from environment variables

// // Middleware
// app.use(cors({
//   credentials: true,
//   origin: process.env.NODE_ENV === 'production' ? 'https://gci-kutus-web.vercel.app' : 'http://localhost:3000'
// }));
// app.use(express.json());
// app.use(cookieParser());
// app.use('/uploads', express.static(__dirname + '/uploads'));

// // MongoDB connection
// mongoose.connect(mongoUri, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// }).then(() => console.log('MongoDB connected'))
//   .catch(err => console.error('MongoDB connection error:', err));

// // File Upload Middleware
// const uploadMiddleware = multer({ dest: 'uploads/' });

// // Register Route
// app.post('/register', async (req, res) => {
//   const { username, password } = req.body;
//   try {
//     const userDoc = await User.create({
//       username,
//       password: bcrypt.hashSync(password, salt),
//     });
//     res.json(userDoc);
//   } catch (e) {
//     console.error(e);
//     res.status(400).json(e);
//   }
// });

// // Login Route
// app.post('/login', async (req, res) => {
//   const { username, password } = req.body;
//   const userDoc = await User.findOne({ username });
//   const passOk = bcrypt.compareSync(password, userDoc.password);
//   if (passOk) {
//     jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
//       if (err) throw err;
//       res.cookie('token', token).json({
//         id: userDoc._id,
//         username,
//       });
//     });
//   } else {
//     res.status(400).json('wrong credentials');
//   }
// });

// // Profile Route
// app.get('/profile', (req, res) => {
//   const { token } = req.cookies;
//   jwt.verify(token, secret, {}, (err, info) => {
//     if (err) throw err;
//     res.json(info);
//   });
// });

// // Logout Route
// app.post('/logout', (req, res) => {
//   res.cookie('token', '').json('ok');
// });

// // Create Post Route
// app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
//   const { originalname, path } = req.file;
//   const parts = originalname.split('.');
//   const ext = parts[parts.length - 1];
//   const newPath = path + '.' + ext;
//   fs.renameSync(path, newPath);

//   const { token } = req.cookies;
//   jwt.verify(token, secret, {}, async (err, info) => {
//     if (err) throw err;
//     const { title, summary, content } = req.body;
//     const postDoc = await Post.create({
//       title,
//       summary,
//       content,
//       cover: newPath,
//       author: info.id,
//     });
//     res.json(postDoc);
//   });
// });

// // Update Post Route
// app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
//   let newPath = null;
//   if (req.file) {
//     const { originalname, path } = req.file;
//     const parts = originalname.split('.');
//     const ext = parts[parts.length - 1];
//     newPath = path + '.' + ext;
//     fs.renameSync(path, newPath);
//   }

//   const { token } = req.cookies;
//   jwt.verify(token, secret, {}, async (err, info) => {
//     if (err) throw err;
//     const { id, title, summary, content } = req.body;
//     const postDoc = await Post.findById(id);
//     const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
//     if (!isAuthor) {
//       return res.status(400).json('you are not the author');
//     }
//     await postDoc.update({
//       title,
//       summary,
//       content,
//       cover: newPath ? newPath : postDoc.cover,
//     });

//     res.json(postDoc);
//   });
// });

// // Get All Posts Route
// app.get('/post', async (req, res) => {
//   res.json(
//     await Post.find()
//       .populate('author', ['username'])
//       .sort({ createdAt: -1 })
//       .limit(20)
//   );
// });

// // Get Single Post by ID
// app.get('/post/:id', async (req, res) => {
//   const { id } = req.params;
//   const postDoc = await Post.findById(id).populate('author', ['username']);
//   res.json(postDoc);
// });

// // Start the Server
// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });






// const express = require('express');
// const cors = require('cors');
// const mongoose = require("mongoose");
// const User = require('./models/User');
// const Post = require('./models/Post');
// const bcrypt = require('bcryptjs');
// const app = express();
// const jwt = require('jsonwebtoken');
// const cookieParser = require('cookie-parser');
// const multer = require('multer');
// const uploadMiddleware = multer({ dest: 'uploads/' });
// const fs = require('fs');

// const salt = bcrypt.genSaltSync(10);
// const secret = 'asdfe45we45w345wegw345werjktjwertkj';

// app.use(cors({credentials:true,origin:'https://gci-kutus-web.vercel.app'}));
// app.use(express.json());
// app.use(cookieParser());
// app.use('/uploads', express.static(__dirname + '/uploads'));

// mongoose.connect('mongodb+srv://gci:Collin@gci.fc2y1.mongodb.net/?retryWrites=true&w=majority&appName=gci');

// app.post('/register', async (req,res) => {
//   const {username,password} = req.body;
//   try{
//     const userDoc = await User.create({
//       username,
//       password:bcrypt.hashSync(password,salt),
//     });
//     res.json(userDoc);
//   } catch(e) {
//     console.log(e);
//     res.status(400).json(e);
//   }
// });

// app.post('/login', async (req,res) => {
//   const {username,password} = req.body;
//   const userDoc = await User.findOne({username});
//   const passOk = bcrypt.compareSync(password, userDoc.password);
//   if (passOk) {
//     // logged in
//     jwt.sign({username,id:userDoc._id}, secret, {}, (err,token) => {
//       if (err) throw err;
//       res.cookie('token', token).json({
//         id:userDoc._id,
//         username,
//       });
//     });
//   } else {
//     res.status(400).json('wrong credentials');
//   }
// });

// app.get('/profile', (req,res) => {
//   const {token} = req.cookies;
//   jwt.verify(token, secret, {}, (err,info) => {
//     if (err) throw err;
//     res.json(info);
//   });
// });

// app.post('/logout', (req,res) => {
//   res.cookie('token', '').json('ok');
// });

// app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
//   const {originalname,path} = req.file;
//   const parts = originalname.split('.');
//   const ext = parts[parts.length - 1];
//   const newPath = path+'.'+ext;
//   fs.renameSync(path, newPath);

//   const {token} = req.cookies;
//   jwt.verify(token, secret, {}, async (err,info) => {
//     if (err) throw err;
//     const {title,summary,content} = req.body;
//     const postDoc = await Post.create({
//       title,
//       summary,
//       content,
//       cover:newPath,
//       author:info.id,
//     });
//     res.json(postDoc);
//   });

// });

// app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
//   let newPath = null;
//   if (req.file) {
//     const {originalname,path} = req.file;
//     const parts = originalname.split('.');
//     const ext = parts[parts.length - 1];
//     newPath = path+'.'+ext;
//     fs.renameSync(path, newPath);
//   }

//   const {token} = req.cookies;
//   jwt.verify(token, secret, {}, async (err,info) => {
//     if (err) throw err;
//     const {id,title,summary,content} = req.body;
//     const postDoc = await Post.findById(id);
//     const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
//     if (!isAuthor) {
//       return res.status(400).json('you are not the author');
//     }
//     await postDoc.update({
//       title,
//       summary,
//       content,
//       cover: newPath ? newPath : postDoc.cover,
//     });

//     res.json(postDoc);
//   });

// });

// app.get('/post', async (req,res) => {
//   res.json(
//     await Post.find()
//       .populate('author', ['username'])
//       .sort({createdAt: -1})
//       .limit(20)
//   );
// });

// app.get('/post/:id', async (req, res) => {
//   const {id} = req.params;
//   const postDoc = await Post.findById(id).populate('author', ['username']);
//   res.json(postDoc);
// })

// app.listen(4000);
// //