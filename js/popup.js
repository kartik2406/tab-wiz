// communicating with background script
var port = chrome.extension.connect({
  name: "Sample Communication"
});
port.onMessage.addListener(function(data) {
  // console.log("message recieved", data);
  if (data.length) {
    addLinks(data);
  } else {
    addLink(data);
  }
  port.postMessage("CLEAR");
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  port.postMessage("GET");
});
chrome.tabs.onActivated.addListener(function(tabId, changeInfo, tab) {
  port.postMessage("GET");
});

//store
let allLinks = [];
let filteredLinks = [];
let db = new Dexie("tab_wiz");
db.version(1).stores({
  links: "url,title,favIconUrl"
});
let linkStore = db.links;

function save(link) {
  delete link["id"]; //delete the id value form the link so that it is not stored in the db
  linkStore.put(link);
}

function saveAll(links) {
  links.forEach(link => {
    delete link["id"];
  });
  linkStore.bulkAdd(links);
}

function deleteFromDB(url) {
  linkStore.delete(url);
}

function deleteAllFromDB() {
  linkStore.clear();
}

function generateListHTML(list) {
  let listHtml = "";
  list.forEach(item => {
    listHtml += `
        <li
        class='list-item'
        >
                <img src='${item.favIconUrl}' class='favIcon'>
                <a 
                href='${item.url}'
                class='link'
                target='_blank'
                >
                    ${item.title}
                </a>
                <i class="material-icons icon delete-icon">delete_forever</i>
        </li>
        `;
  });
  return listHtml;
}

function setListView(links) {
  let list = document.getElementById("list");
  list.innerHTML = generateListHTML(links);
  let deleteBtns = document.querySelectorAll(".delete-icon");

  let tabNumber = document.querySelector(".tab-number");
  tabNumber.textContent = links.length;
  deleteBtns.forEach(btn => {
    let link = btn.previousElementSibling;
    let url = link.getAttribute("href");
    btn.addEventListener(
      "click",
      deleteLink.bind({
        url
      })
    );
  });

  let appControlBtns = document.querySelectorAll(
    ".app-controls .can-be-disabled"
  );
  if (links.length) {
    appControlBtns.forEach(btn => {
      btn.classList.remove("disabled");
    });
  } else {
    appControlBtns.forEach(btn => {
      btn.classList.add("disabled");
    });
  }
}

function closeTab(tabID) {
  chrome.tabs.remove(tabID, function() {
    console.log("tabs closed");
  });
}

function linkExists(link) {
  return allLinks.find(item => item.url == link.url) ? true : false;
}
async function init() {
  allLinks = await linkStore.toArray();
  setListView(allLinks);
}
init();
async function addLink(link) {
  closeTab(link.id);
  await init();
  if (!linkExists(link)) {
    try {
      await save(link);
      allLinks.push(link);
      setListView(allLinks);
    } catch (err) {
      console.log("Could not save to db");
    }
  }
}

async function addLinks(tabLinks) {
  tabLinks.forEach(tab => {
    console.table(tab);
    closeTab(tab.id);
  });
  await init();
  let linkUrls = allLinks.map(link => link.url);
  let newLinks = tabLinks.filter(link => !linkUrls.includes(link.url));
  let newUrls = tabLinks.map(link => link.url); //temp array containing just urls
  newLinks = newLinks.filter((link, index) => {
    return newUrls.indexOf(link.url) == index; // if index is not same that means it is not unique
  });
  await saveAll(newLinks);
  allLinks = allLinks.concat(newLinks);
  setListView(allLinks);
}
async function deleteLink() {
  try {
    await deleteFromDB(this.url);
    allLinks = allLinks.filter(link => link.url != this.url);
    setListView(allLinks);
  } catch (err) {
    console.log("error while deleting");
  }
}
let searchBox = document.getElementById("searchInput");

//checks if there is a filtered links list, if so returns it else returns allLinks list
function isFilteredList() {
  return filteredLinks.length && filteredLinks.length != allLinks.length;
}
async function deleteAll() {
  let links = isFilteredList() ? filteredLinks : allLinks;
  if (links.length) {
    //only if there are values in the links array
    let deleteConfirm;
    if (this.showPrompt)
      deleteConfirm = confirm("Do you really want to delete all the links?");

    if (deleteConfirm || !this.showPrompt) {
      // showPrompt if not set will delete without confirm box
      try {
        if (isFilteredList()) {
          links.forEach(async link => {
            let url = link.url;
            await deleteLink.bind({ url })();
          });
          searchBox.value = "";
        } else {
          await deleteAllFromDB();
        }
        //reset
        filteredLinks= [];
        links= [];
        
        setListView(allLinks);
      } catch (err) {
        console.log(err);
      }
    }
  }
}

let deleteAllBtn = document.getElementById("deleteAll");
deleteAllBtn.addEventListener(
  "click",
  deleteAll.bind({
    showPrompt: true
  })
);

async function restoreAll() {
  if (allLinks.length) {
    allLinks.forEach(link => {
      chrome.tabs.create({
        url: link.url
      });
    });
    await deleteAll();
    window.close();
  }
}

let restoreAllBtn = document.getElementById("restoreAll");
restoreAllBtn.addEventListener("click", restoreAll);

let exportBtn = document.getElementById("export");
exportBtn.addEventListener("click", function() {
  var file = new Blob([JSON.stringify(allLinks)], { type: "text/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = "tabs.json"; //file name
  a.click();
});

let importBtn = document.getElementById("import");
importBtn.addEventListener("click", function() {
  let fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.click();
  fileInput.addEventListener("change", function(data) {
    console.log(data);
    let file = fileInput.files[0];
    console.log(file);
    var reader = new FileReader(file);
    reader.readAsText(file);
    reader.onload = async function(e) {
      // browser completed reading file - display it
      let importLinks = e.target.result;
      try {
        importLinks = JSON.parse(importLinks);
        console.log(importLinks);
        //Todo: validation
        await saveAll(importLinks);
        allLinks = allLinks.concat(importLinks);
        setListView(allLinks);
      } catch (err) {
        console.log(err);

        alert("File type is not supported");
      }
    };
  });
});


searchBox.addEventListener("keyup", function(event) {
  console.log("key", event.target.value);
  let searchText = event.target.value.toLocaleLowerCase();
  searchText
    ? (filteredLinks = allLinks.filter(link =>
        link.title.toLocaleLowerCase().includes(searchText)
      ))
    : (filteredLinks = allLinks);
  setListView(filteredLinks);
});
