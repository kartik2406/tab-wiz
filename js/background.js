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

let tabDetails;

chrome.browserAction.onClicked.addListener(async function (tab) {
    tabDetails = await getCurrentTab();
    let url = chrome.extension.getURL('popup.html');

    //port.postMessage(tabDetails);
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

});

chrome.extension.onConnect.addListener(function (port) {
    console.log("Connected .....");
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