const electron = require('electron');
const axios = require("axios");
const cheerio = require("cheerio");
const iconv = require("iconv-lite");

const els = {
  launch: {
    articleList: document.getElementById("custom__article-list"),
    pre: {
      container: document.getElementById("custom_pre-launch"),
      btn: document.getElementById("custom_pre-launch")
    },
    post: {
      container: document.getElementById("custom_post-launch"),
      txt: document.getElementById("custom__launch-text")
    }
  }
};

els.launch.pre.btn.addEventListener("click", function () {
  els.launch.pre.container.style.display = "none";
  els.launch.post.container.style.display = "";
});

function hrefWorker(el) {
  el.addEventListener("click", () => {
    const link = el.getAttribute("href");
    electron.shell.openExternal(link);
  })
}

hrefWorker(document.getElementById("custom_nav__sv_discord"));
hrefWorker(document.getElementById("custom_nav__sp_discord"));
hrefWorker(document.getElementById("custom_nav__ow_youtube"));



class CafeArticleCrawler {
  /**
   * @typedef Article
   * @property {string} name
   * @property {string} href
   * @property {string} title
   * @property {string} article
   */

  #cafeLink = "";
  #articleListLink = "";
  /** @type {Article[]} */
  #articles = [];
  #loading = true;

  /**
   * @param {string} articleListLink 
   */
  constructor(articleListLink) {
    this.#cafeLink = articleListLink.split("?")[0];
    this.#articleListLink = articleListLink;
    this.#articles = [];

    this.#init();
  }

  async #init() {
    await this.#initArticleList();
    this.#loading = false;
  }

  /**
   * @param {string} link 
   */
  async #getHtml(link) {
    let html = await axios.get(
      link,
      {responseType: 'arraybuffer', responseEncoding: 'binary'}
    );
    html = iconv.decode(Buffer.from(html.data), "KSC5601");
    return cheerio.load(html);
  }

  async #initArticleList() {
    const $ = await this.#getHtml(this.#articleListLink);
  
    const listEls = $("div.article-board").last().find("table > tbody > tr .article");
    const listElArr = listEls.toArray();

    const names = listEls.text().split("\n").map(v => v.trim()).filter(v => v.length > 0);

    for (let i = 0; i < listElArr.length; i++) {
      const itemEl = listElArr[i];
      const href = this.#cafeLink + itemEl.attribs.href;
      const article = await this.#getArticle(href);

      this.#articles.push({
        name: names[i],
        href,
        title: article.title,
        article: article.article
      });
    }
  }

  /**
   * @param {string} herf 
   */
  async #getArticle(link) {
    const $ = await this.#getHtml(link);

    const title = $("#spiButton").attr("data-title");
    
    const rawArticle = $(".se-main-container").text();
    const article = rawArticle.trim();
    
    return { title, article };
  }
  /**
   * @returns {Promise<boolean>}

   */
  async #waitLoading() {
    if (!this.#loading) {
      return true;
    }
    return await new Promise((res) => {
      let looper = setInterval(() => {
        if (this.#loading) {
          return;
        } else {
          res(true);
          clearInterval(looper);
        }
      }, 1000);
    });
  }

  async getArticleList() {
    await this.#waitLoading();
    return this.#articles.map(item => ({...item}));
  }

  /**
   * @param {number} idx 
   * @returns {Article}
   */
  async getArticle(idx) {
    await this.#waitLoading();
    const article = this.#articles[idx];
    return article ?? {
      article: "",
      href: "",
      name: "",
      title: ""
    };
  }

  /**
   * @param {Article} article 
   * @returns {HTMLDivElement} 
   */
  static elementify(article) {
    const item = document.createElement("div");
    item.classList.add("naver-article");
    item.addEventListener("click", function () {
      electron.shell.openExternal(article.href);
    });

    const title = document.createElement("span");
    title.classList.add("naver-article__title");
    title.innerText = article.title;
    item.appendChild(title);

    const content = document.createElement("span");
    content.classList.add("naver-article__content");
    content.innerText = article.article;
    item.appendChild(content);

    return item;
  }
}

const crawler = new CafeArticleCrawler("https://cafe.naver.com/mentalward24/ArticleList.nhn?search.clubid=31002531&search.menuid=2&search.boardtype=L");
crawler.getArticleList()
  .then(list => {
    console.log("개시글 목록: ", list);
    for (let i = 0; i < Math.min(list.length, 5); i++) {
      els.launch.articleList.appendChild(CafeArticleCrawler.elementify(list[i]));
    }
  })
  .catch(e => {
    console.error(e);
  });
