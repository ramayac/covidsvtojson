const path = require('path');
const fs = require('fs');

const fetch = require('node-fetch');
const dateFormat = require("dateformat");

const REPLACE_ACCENTS = [
 ['ñ', 'n'],
 ['á', 'a'], 
 ['é', 'e'], 
 ['í', 'i'],
 ['ó', 'o'],
 ['ú', 'u']
];

function extractJSFromPage(date){
    var inFilename = 'pages\\'+ date +'.html';
    var outJson = 'json\\' + date + '.json';

    var html = fs.readFileSync(path.resolve(__dirname, inFilename));
    
    var script = html.toString();
    //I don't feel shame if it gets the work done.
    var strWs = script.split('var ws_data =')[1].split('var ws = ')[0];
    strWs = strWs.split("['','','',''],")[2];
    strWs = strWs.split("['Municipios'],")[1];
    strWs = strWs.replace(/\[/g, '');
    strWs = strWs.replace(/\n/g, '');
    strWs = strWs.replace('];', '');
    strWs = strWs.split("],");

    var jItems = [];
    for(let i of strWs){
        if(i){
            //console.log(i);
            i = cleanResults(i.trim());
            i = parseItem(i);
            if(i){
                jItems.push(i);
            }
        }
    }

    console.log('Processed date: ' + date);
    fs.writeFileSync(outJson, JSON.stringify(jItems));
    return jItems;
}

/**
 * Kind of cleans the item node, removing tabs, and new lines.
 */
function cleanResults(item){
    let cleanItem = item.replace(/\t/g, ' ').replace(/\n/g, '').replace(/\'/g, '').trim();
    return cleanItem;
}

/**
 * Cleans a string, removes tildes and ñ, spaces and makes it lower case.
 */
function stringToId(str){
    var strId = str.toLowerCase().replace(/ /g, '');
    REPLACE_ACCENTS.forEach(function(element){
        //console.log(element);
        strId = strId.replace(element[0], element[1]);
    });
    return strId;
}

/**
 * Split the string using ', de' and ',' to have a nice packed array.
 */
function parseItem(item){
    if(item == '') return null;

    var arrDe = item.split(', de'); //avoid issues with "Candelaria de la frontera"
    var quantity = arrDe[0].trim();
    var municDept = arrDe[1].trim().split(',');
    var munic = (municDept[0] == undefined ? '' : municDept[0].trim());
    var dept = (municDept[1] == undefined ? '' : municDept[1].trim());

    return { 
        "cantidad" : quantity, 
        "idmunicipio": stringToId(munic),
        "municipio" : munic,
        "iddepartamento": stringToId(dept),
        "departamento": dept, 
        "row" : quantity + ":" + municDept
    };
}

/**
 * Download html and save it to a file.
 * @param {*} url 
 * @param {*} path 
 */
const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
      });
  });

function fetchPageAndSaveIt(date){
    const COVID_URL_PAGE = 'https://diario.innovacion.gob.sv/?fechaMostrar=';
    var url = COVID_URL_PAGE + date;
    var path = 'pages/' + date + '.html';

    try {
        downloadFile(url, path);
    } catch (err) {
        console.error(err);
    }
}

function getDateRange(start, end) {
    var arr = new Array();
    var dt = start;
    while (dt <= end) {
        arr.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}

function fetchAllPagesAndSaveThem(arrOfDates){
    arrOfDates.forEach(function(value){
        console.log('Fetching ...' + value);
        fetchPageAndSaveIt(value);
    });
}

function extractJsData(arrOfDates){
    var allItems = [];
    arrOfDates.forEach(function(value){
        console.log('Processing JS ...' + value);
        const item = extractJSFromPage(value);
        allItems[value] = item;
    });
    return allItems;
}

function consolidateAllData(arrOfDates){
    var allItems = [];
    arrOfDates.forEach(function(value){
        let rawContent = fs.readFileSync('json\\' + value + '.json');
        let parsedContent = JSON.parse(rawContent);
        //console.log(parsedContent);
        allItems.push({'fecha' : value, 'datos' : parsedContent});
    });

    fs.writeFileSync('consolidado.json', JSON.stringify(allItems));
}

var startDate = new Date("2020-04-28"), endDate = new Date("2021-02-03");
//var startDate = new Date("2020-08-21"), endDate = new Date("2020-08-22");

var dateRange = getDateRange(startDate, endDate);
var formatedDateRange = [];
dateRange.forEach(function(value){
    var svDateFormat = dateFormat(value, "dd-mm-yyyy");
    formatedDateRange.push(svDateFormat);
});

//Steps: 
//1 - Fetch all the pages from a date range. Takes like a minute to download all...
//fetchAllPagesAndSaveThem(formatedDateRange);
//2 - extract the info.
extractJsData(formatedDateRange);
//3 - consolidate
consolidateAllData(formatedDateRange);
//4 - profit
