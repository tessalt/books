const fetch = require("node-fetch");

const URL = "https://www.googleapis.com/books/v1/volumes";

module.exports = {
  searchBooks: async query => {
    if (query && query.length > 0) {
      const result = await fetch(
        URL + "?q=" + encodeURI(query) + "&key=" + process.env.GOOGLE_BOOKS_KEY
      );
      const data = await result.json();
      if (data.items && data.items.length > 0) {
        return data.items.map(item => ({
          id: item.id,
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors ? item.volumeInfo.authors.join(", ") : "",
          year: new Date(item.volumeInfo.publishedDate).getFullYear(),
          description: item.volumeInfo.description,
          image_url: item.volumeInfo.imageLinks ? item.volumeInfo.imageLinks.thumbnail : ""
        }));
      }
      return [];
    }
    return [];
  }
};
