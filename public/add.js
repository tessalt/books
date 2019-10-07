function debounce(func, interval) {
  var timeout;
  return function() {
    var context = this,
      args = arguments;
    var later = function() {
      timeout = null;
      func.apply(context, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, interval || 200);
  };
}

class Booksearch {
  constructor(form, input, results, selected, loader) {
    this.books = [];
    this.selected = null;
    this.form = form;
    this.input = input;
    this.loader = loader;
    this.results = results;
    this.div = selected;
    this.editing = null;
  }

  searchBooks(query) {
    this.loader.classList.remove("hidden");
    fetch("/booksearch?search=" + query).then(data => {
      this.loader.classList.add("hidden");
      data.json().then(results => {
        this.books = results.books;
        this.renderResults();
      });
    });
  }

  bindEventListeners() {
    this.form.addEventListener("submit", evt => {
      evt.preventDefault();
      this.searchBooks(this.input.value);
    });
    this.results.addEventListener("click", evt => {
      if (evt.target && evt.target.nodeName == "LI") {
        const book = this.books.find(book => book.id === evt.target.id);
        this.selected = book;
        this.books = [];
        this.renderResults();
        this.renderSelected();
      }
    });    
  }

  renderResults() {
    this.results.innerHTML = "";
    this.books.forEach(result => {
      const li = document.createElement("li");
      li.setAttribute("id", result.id);
      li.classList.add("search-result");
      li.textContent = result.title + " — " + result.author;
      this.results.appendChild(li);
    });
  }

  renderSelected() {
    if (this.selected) {
      this.input.value = "";
      this.div.classList.remove("hidden");
      this.div.querySelector("#info").innerHTML = "<img src=" + this.selected.image_url + "/>" + "<strong>" + this.selected.title + "</strong><br />" + this.selected.author + ", " + this.selected.year;
      this.div.querySelector("#title").value = this.selected.title;
      this.div.querySelector("#year").value = this.selected.year;
      this.div.querySelector("#author").value = this.selected.author;
      this.div.querySelector("#image_url").value = this.selected.image_url;
      this.div.querySelector("#description").value = this.selected.description;
      this.div.querySelector("#source_id").value = this.selected.id;
    } else {
      this.div.classList.add("hidden");
    }
  }
}

const search = document.getElementById("search");
const query = document.getElementById("query");
const resultsList = document.getElementById("results");
const selected = document.getElementById("selected");
const loader = document.getElementById("loading");

const books = new Booksearch(search, query, resultsList, selected, loader);
books.bindEventListeners();

const datepicker = document.getElementById("datePicker");

if (datepicker) {
  datepicker.value = new Date()
  .toISOString()
  .substr(0, 10);
}
