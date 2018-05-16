// communicating with background script
var port = chrome.extension.connect({
    name: "Sample Communication"
});
port.onMessage.addListener(function (link) {
    console.log("message recieved", link);
    addLink(link);
    port.postMessage('CLEAR');
});

chrome.tabs.onUpdated.addListener(
    function (tabId, changeInfo, tab) {
        console.log('updated from contentscript');
        port.postMessage("GET");
    }
);
chrome.tabs.onActivated.addListener(
    function (tabId, changeInfo, tab) {
        console.log('tab activated');
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

function deleteFromDB(url) {
    linkStore.delete(url);
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

    deleteBtns.forEach(btn => {
        let link = btn.previousElementSibling;
        let url = link.getAttribute('href');
        btn.addEventListener('click', deleteLink.bind({
            url
        }));
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
    await init();
    if (!linkExists(link)) {
        console.log('Tab url', link);
        try {
            await save(link);
            links.push(link);
            setListView();
        } catch (err) {
            console.log('Could not save to db')
        }
    }
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