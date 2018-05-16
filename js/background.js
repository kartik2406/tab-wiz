function getCurrentTab() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            let tab = tabs[0];
            if (!tab) {
                reject(null);
            }
            let link = {
                favIconUrl: tab.favIconUrl,
                title: tab.title,
                url: tab.url
            }
            resolve(link);
        })
    });
}

let tabDetails, globalPort;

function openExtensionTab() {
    let url = chrome.extension.getURL('popup.html');
    chrome.tabs.query({
        url
    }, function (tabs) {
        if (tabs[0]) {
            let extTab = tabs[0];
            chrome.tabs.update(extTab.id, {
                active: true
            });

        } else {
            //open new tab
            chrome.tabs.create({
                url,
                active: true
            });
        }
    });
}
chrome.browserAction.onClicked.addListener(async function (tab) {
    tabDetails = await getCurrentTab();
      openExtensionTab();

});

chrome.extension.onConnect.addListener(function (port) {
    console.log("Connected .....");
    globalPort = port;
    port.onMessage.addListener(function (msg) {
        console.log("message recieved" + msg);
        switch (msg) {
            case 'GET':
                if (tabDetails)
                    port.postMessage(tabDetails);
                break;
            case 'CLEAR':
                tabDetails = null;
                break;
        }
    });
})

async function addTab() {
    tabDetails = await getCurrentTab();
    let port = chrome.extension.connect({
        name: "Sample Communication"
    });
    openExtensionTab();
    
    port.postMessage(tabDetails);
}
chrome.contextMenus.create({
    id: '1',
    title: "Add Page to TabWiz",
    contexts: ["all"]
});
chrome.contextMenus.onClicked.addListener(addTab);