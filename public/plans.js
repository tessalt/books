class Books {
  constructor(container) {
    this.container = container;
    this.editing = null;
  }

  addEventListeners() {
    [...document.querySelectorAll(".edit-book")].forEach(item => {
      item.addEventListener("click", evt => {
        this.editing = parseInt(evt.target.dataset["bookid"]);
        this.renderEditing();
      });
    });
    [...document.querySelectorAll(".cancel-edit")].forEach(item => {
      item.addEventListener("click", evt => {
        this.editing = null;
        this.renderEditing();
      });
    });
  }

  renderEditing() {
    const div = document.getElementById("plan-" + this.editing);

    if (this.editing) {
      const form = div.querySelector(".book-edit-form");

      form.classList.remove("hidden");
    } else {
      [...document.querySelectorAll(".book-edit-form")].forEach(item => {
        item.classList.add("hidden");
      });
    }
  }
}

const container = document.querySelector(".books");
if (container) {
  const books = new Books(container);
  books.addEventListeners();
}
