// communicating with background script
var port = chrome.extension.connect({
    name: "Sample Communication"
});
port.onMessage.addListener(function (data) {
    // console.log("message recieved", data);
    if (data.length) {
        addLinks(data);
    } else {
        addLink(data);
    }
    port.postMessage('CLEAR');
});

chrome.tabs.onUpdated.addListener(
    function (tabId, changeInfo, tab) {
        port.postMessage("GET");
    }
);
chrome.tabs.onActivated.addListener(
    function (tabId, changeInfo, tab) {
        port.postMessage("GET");
    }
);

//store
let links = [];
let db = new Dexie("one_tab");
db.version(1).stores({
    links: 'url,title,favIconUrl'
});
let linkStore = db.links;

function save(link) {
    linkStore.put(link);
}

function saveAll(links) {
    linkStore.bulkAdd(links);
}

function deleteFromDB(url) {
    linkStore.delete(url);
}

function deleteAllFromDB() {
    linkStore.clear();
}

function generateListHTML(list) {
    let listHtml = '';
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
        `
    });
    return listHtml;
}

function setListView() {
    let list = document.getElementById('list');
    list.innerHTML = generateListHTML(links);
    let deleteBtns = document.querySelectorAll('.delete-icon');

    let tabNumber = document.querySelector('.tab-number');
    tabNumber.textContent = links.length;
    deleteBtns.forEach(btn => {
        let link = btn.previousElementSibling;
        let url = link.getAttribute('href');
        btn.addEventListener('click', deleteLink.bind({
            url
        }));
    })
    let appControlBtns = document.querySelectorAll('.app-controls button')
    if (links.length) {
        appControlBtns.forEach(btn => {
            btn.classList.remove('disabled');
        })
    } else {
        appControlBtns.forEach(btn => {
            btn.classList.add('disabled');
        })
    }

}

function closeTab(url) {
    chrome.tabs.query({
        url
    }, function (tabs) {
        let tabIDs = tabs.map(tab => tab.id);
        chrome.tabs.remove(tabIDs, function () {
            console.log('tabs closed');

        })
    })
}

function linkExists(link) {

    return links.find(item => item.url == link.url) ? true : false;
}
async function init() {
    links = await linkStore.toArray();
    setListView();
}
init();
async function addLink(link) {
    closeTab(link.url);
    await init();
    if (!linkExists(link)) {
        try {
            await save(link);
            links.push(link);
            setListView();
        } catch (err) {
            console.log('Could not save to db')
        }
    }
}

async function addLinks(tabLinks) {
    tabLinks.forEach(tab => {
        console.table(tab);
        closeTab(tab.url);
    })
    await init();
    let linkUrls = links.map(link => link.url);
    let newLinks = tabLinks.filter(link => !linkUrls.includes(link.url));
    await saveAll(newLinks);
    links = links.concat(newLinks);
    setListView();
}
async function deleteLink() {
    try {
        await deleteFromDB(this.url);
        links = links.filter(link => link.url != this.url);
        setListView();
    } catch (err) {
        console.log('error while deleting');
    }
}
async function deleteAll() {
    if (links.length) {
        let deleteConfirm;
        if (this.showPrompt)
            deleteConfirm = confirm('Do you really want to delete all the links?');

        if (deleteConfirm || !this.showPrompt) {
            try {
                await deleteAllFromDB();
                links = [];
                setListView();
            } catch (err) {
                console.log(err);
            }
        }
    }
}
async function restoreAll() {
    if (links.length) {
        links.forEach(link => {
            chrome.tabs.create({
                url: link.url
            });
        });
        await deleteAll();
        window.close();
    }
}

let deleteAllBtn = document.getElementById('deleteAll');
deleteAllBtn.addEventListener('click', deleteAll.bind({
    showPrompt: true
}));

let restoreAllBtn = document.getElementById('restoreAll');
restoreAllBtn.addEventListener('click', restoreAll);