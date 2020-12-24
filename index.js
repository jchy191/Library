const { ApolloServer, gql, UserInputError } = require('apollo-server');
const mongoose = require ('mongoose');
const Book = require('./models/Book.js');
const Author = require('./models/Author.js');
require('dotenv').config();
const { v1: uuid } = require('uuid');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.log('Error connecting to MongoDB:', error.message);
  });

const typeDefs = gql`
  type Book {
    title: String!,
    published: Int!,
    author: Author!,
    id: ID!,
    genres: [String!],
  },
  type Author {
    name: String!,
    id: ID!,
    born: Int,
    bookCount: Int!,
  },
  type User {
    username: String!,
    favouriteGenre: String!,
    id: ID!,
  },
  type Token {
    value: String!
  },
  type Query {
    bookCount: Int!,
    authorCount: Int!,
    allBooks(author: String, genre: String): [Book!]!,
    allAuthors: [Author!]!,
    me: User
  },
  type Mutation {
    addBook(
      title: String!,
      published: Int!,
      author: String!,
      genres: [String!],
    ): Book,
    editAuthor(
      name: String!,
      setBornTo: Int!,
    ): Author,
    createUser(
      username: String!,
      favouriteGenre: String!
    ): User,
    login(
      username: String!,
      password: String!
    ): Token
  }
`;

const resolvers = {
  Query: {
    bookCount: () => Book.collection.countDocuments(),
    authorCount: () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      let author;
      if (args.author) {
        author = await Author.findOne({ name: args.author });
      }
      switch(true) {
      case Boolean(args.author) && Boolean(args.genre):
        return Book.find({
          $and: [
            { author: author._id },
            { genres: { $in: [args.genre] } }
          ]
        }).populate('author');
      case Boolean(args.author):
        return Book.find({ author: author._id }).populate('author');
      case Boolean(args.genre):
        return Book.find({ genres: { $in: [args.genre] } }).populate('author');
      default:
        return Book.find({}).populate('author');
      }
    },
    allAuthors: () => Author.find({}),
    me: (root, args, context) => context.currentUser
  },
  Mutation: {
    addBook: async (root, args) => {
      let author = await Author.findOne({ name: args.author });
      if (!author) {
        author = new Author({ name: args.author, id: uuid() });
        try {
          await author.save();
        } catch (error) {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          });
        }
      }
      const newBook = new Book({ ...args, author: author, id: uuid() });
      try {
        return await newBook.save();
      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      }
    },
    editAuthor: async (root, args) => {
      let authorToEdit;
      try {
        authorToEdit = await Author.findOneAndUpdate({ name: args.name },
          { born: args.setBornTo },
          { new: true, runValidators: true }
        );      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      }
      if (!authorToEdit) return null;
      return authorToEdit;
    },
    createUser: (root, args) => {
      const user = new User ({ username: args.username, favouriteGenre: args.favouriteGenre });
      return user.save()
        .catch(error => {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          });
        });
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });
      if ( !user || args.password !== 'secret' ) {
        throw new UserInputError('Wrong credentials');
      }
      const userForToken = {
        username: user.username,
        id: user._id
      };

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    }
  },
  Author: {
    bookCount: (root) => {
      return Book.find({ author: { _id: `${root._id}` } }).countDocuments();
    }
  }
};


const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_SECRET
      );
      const currentUser = await User.findById(decodedToken.id).populate('friends');
      return { currentUser };
    }
  }
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});