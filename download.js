/*
TODO: Better error catching and simplify both test cases and codebase.
*/

import fs from 'fs-extra';
import readLine from 'readline';
import fetch from 'node-fetch';
import crypto from 'crypto';
import colorIt from 'color-it';
import shelljs from 'shelljs';
import defaultData from './edit_here_to_add_blocklists.json' assert { type: 'json' };
const { createWriteStream, createReadStream } = fs;
const DOWNLOAD_FOLDER = './downloaded_files/';
const CONFIG_FOLDER = './config/';
const CF_FOLDER = './custom_filters/';
const PROCESSING_FOLDER = './processed_files/';
const SOURCE_FOLDER = './sources/';
const MAX_ATTEMPTS = 3;

async function downloadFiles() {
  let urlSources = [];
  console.log('' + colorIt(`Starting downloadFiles function`).indigo());

  for (let x in defaultData.blocklistConfig) {
    for (let y in defaultData.blocklistConfig[x].url) {
      urlSources.push(defaultData.blocklistConfig[x].url[y]);
    }
  }

  // Get unique urls from the list as urls can be repeated and used in multiple places.
  let uniqueUrlSources = Array.from(new Set(urlSources));

  fs.mkdirSync(DOWNLOAD_FOLDER, { recursive: true });

  console.log('Total number of lists to download and process : ' + uniqueUrlSources.length);
  console.log(`Attempting to download files, only files failed to download will be logged`);

  const downloadPromises = uniqueUrlSources.map(async (url) => {
    let file_name = `i_${crypto.createHash('md5').update(url).digest('hex')}`;
    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
      try {
        const response = await fetch(url, { method: 'GET' });

        if (response.ok) {
          const writePromise = new Promise((resolve, reject) => {
            response.body
              .pipe(
                createWriteStream(DOWNLOAD_FOLDER + file_name, {
                  flags: 'w',
                })
              )
              .on('finish', resolve)
              .on('error', reject);
          });
          await writePromise;
          break;
        }
      } catch (error) {
        console.log(`Attempt ${attempts + 1} failed to download ${url}`);
      }
      attempts++;
    }
    if (attempts === MAX_ATTEMPTS) {
      console.log('' + colorIt(`Failed to download ${url} after ${MAX_ATTEMPTS} attempts`).redBg());
    }
  });

  await Promise.all(downloadPromises);
  console.log(`Downloaded all files`);
  console.log('' + colorIt(`Finished downloadFiles function`).green());
  console.log('------------------------------------------------\n');
}

async function processFiles() {
  console.log('' + colorIt(`Starting processFiles function`).indigo());

  if (!fs.existsSync(DOWNLOAD_FOLDER)) {
    console.log('Folder does not exist');
    process.exit(1);
  }
  // removing this folder if it exists as we always append the data to the file.
  if (fs.existsSync(PROCESSING_FOLDER)) {
    fs.removeSync(PROCESSING_FOLDER);
  }
  // create tmp folder for processing files
  !fs.existsSync(PROCESSING_FOLDER) && fs.mkdirSync(PROCESSING_FOLDER);

  // There aren't any subfolders present in this directory.
  let file_name = fs.readdirSync(DOWNLOAD_FOLDER);

  console.log(`Found ${file_name.length} files in directory`);

  for (let x in file_name) {
    await processLineByLine(file_name[x]);
  }
  console.log(`Finished processing files`);
  console.log('' + colorIt(`Finished processFiles function`).green());
  console.log('------------------------------------------------\n');
}

//  https://stackoverflow.com/a/32599033
async function processLineByLine(fl) {
  const fileStream = createReadStream(DOWNLOAD_FOLDER + fl);
  const WS = createWriteStream(PROCESSING_FOLDER + fl, { flags: 'a' });

  const rl = readLine.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  /* Does the regex work? Yes! 
  Can it be improved further? Yes, of course!
  */
  for await (const line of rl) {
    var str = line;
    var data = str
      .replace(/(^[-\._!/:&=?~#].*$)|(^.*[\[\$/@>].*$)|(^.*[a-zA-Z0-9-_^/]+#.*$)|(.+\*.*$)/gim, '')
      .replace(/(#.*$)|(^\*\.)|(([0-9]{1,3}\.){3}[0-9]{1,3})([ \t]+)|((::)([ \t]+))|((::)+[1]([ \t]+))/, '')
      .match(/(^.*xn--.*$)|((([a-zA-Z0-9-_]{1,})\.)+[a-zA-Z]{2,})/);

    if (data) {
      WS.write(data[0] + '\n');
    }
  }
  WS.end();
}

async function copyFiles() {
  console.log('' + colorIt(`Starting copyFiles function`).indigo());

  try {
    fs.mkdirSync(CF_FOLDER, { recursive: true });
    console.log('Attempting to copy files to custom_filter folder');
    fs.copySync(PROCESSING_FOLDER, CF_FOLDER);
    console.log('' + colorIt('Copied files successfully to folder!').greenBg());
  } catch (err) {
    console.error('' + colorIt('Unable to copy files to folder!').redBg() + err);
  }
  console.log('' + colorIt(`Finished copyFiles function`).green());
  console.log('------------------------------------------------\n');
}

async function generateConfigs() {
  console.log('' + colorIt(`Starting generateConfigs function`).indigo());

  fs.mkdirSync(CONFIG_FOLDER, { recursive: true });
  if (fs.existsSync(SOURCE_FOLDER)) {
    fs.removeSync(SOURCE_FOLDER);
  }
  fs.mkdirSync(SOURCE_FOLDER, { recursive: true });

  var cusFil = [];
  var conn = {
    adblock: [],
    adultfilter: [],
  };
  var fileHashes = {};

  var dataBlocklist = defaultData.blocklistConfig;
  var dataAdblock = dataBlocklist.filter((dataBlocklist) => defaultData.adblockConfig.includes(dataBlocklist.value));
  var dataAdult = dataBlocklist.filter((dataBlocklist) => defaultData.adultfilterConfig.includes(dataBlocklist.value));

  for (let blocklist of dataAdblock) {
    for (let i = 0; i < blocklist.url.length; i++) {
      let url = blocklist.url[i];
      let filterType = blocklist.filterType[i];
      conn.adblock.push(
        `i_${crypto
          .createHash('md5')
          .update(url + '+' + filterType)
          .digest('hex')}`
      );
    }
  }
  for (let blocklist of dataAdult) {
    for (let i = 0; i < blocklist.url.length; i++) {
      let url = blocklist.url[i];
      let filterType = blocklist.filterType[i];
      conn.adultfilter.push(
        `i_${crypto
          .createHash('md5')
          .update(url + '+' + filterType)
          .digest('hex')}`
      );
    }
  }

  for (let blocklist of dataBlocklist) {
    let total = 0;
    let id = 'id' + blocklist.value;
    var conn_arr = [];
    for (let i = 0; i < blocklist.url.length; i++) {
      let url = blocklist.url[i];
      let filterType = blocklist.filterType[i];
      let flHa = `i_${crypto.createHash('md5').update(url).digest('hex')}`;
      fileHashes[flHa] = url;
      conn_arr.push(
        `i_${crypto
          .createHash('md5')
          .update(url + '+' + filterType)
          .digest('hex')}`
      );
      await fs.promises.appendFile(SOURCE_FOLDER + id + '.md', `## ${url}\n`);
      await countLines(CF_FOLDER + flHa)
        .then((lineCount) => {
          total += lineCount;
        })
        .catch((err) => {
          console.error(err);
        });
    }
    conn[id] = conn_arr;
    blocklist.totalDomains = total;
    blocklist.source = 'https://github.com/dnswarden/blocklist-staging/blob/main/sources/' + id + '.md';
    cusFil.push(blocklist);
  }
  conn['discard'] = ['discard'];
  conn['uncensored'] = ['uncensored'];

  await fs.promises.writeFile(CONFIG_FOLDER + 'hashes.json', JSON.stringify(fileHashes), 'utf8');
  await fs.promises.writeFile(CONFIG_FOLDER + 'conn.json', JSON.stringify(conn), 'utf8');

  await fs.promises.writeFile(CONFIG_FOLDER + 'customfilter.json', JSON.stringify(cusFil), 'utf8');

  console.log('' + colorIt(`Finished generateConfigs function`).green());
  console.log('------------------------------------------------\n');
}

function countLines(filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const fileStream = fs.createReadStream(filePath);
    const rl = readLine.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    rl.on('line', () => {
      lineCount++;
    });
    rl.on('close', () => {
      resolve(lineCount);
    });
    rl.on('error', (err) => {
      reject(err);
    });
  });
}

async function checkFiles() {
  console.log('' + colorIt(`Starting checkFiles function`).indigo());
  let hashes;
  try {
    const data = fs.readFileSync(CONFIG_FOLDER + 'hashes.json', 'utf-8');
    hashes = JSON.parse(data);
  } catch (err) {
    console.error(err);
  }
  let hashes_arr = Object.keys(hashes);

  const files = fs.readdirSync(CF_FOLDER);
  const toAdd = hashes_arr.filter((element) => !files.includes(element));
  const toRemove = files.filter((element) => !hashes_arr.includes(element));

  for (let x in toAdd) {
    fs.writeFileSync(CF_FOLDER + toAdd[x], `some.invalid.domain`);
  }

  for (let y in toRemove) {
    fs.removeSync(CF_FOLDER + toRemove[y]);
  }
  console.log('' + colorIt(`Finished checkFiles function`).green());
  console.log('------------------------------------------------\n');
}

async function updateHistory() {
  console.log('' + colorIt(`Starting updateHistory function`).indigo());

  const totalLines = parseInt(
    shelljs.exec(`wc -l ${CF_FOLDER}/* | grep total | sed 's/total//g'`, { silent: true }).stdout
  );
  const dateUTC = shelljs.exec('date -u', { silent: true }).stdout.trim();
  const string = `Updated at : ${dateUTC} , total domains in repo : ${totalLines}`;
  shelljs.echo(string).toEnd('./update_history.txt');
  console.log('' + colorIt(`Finished updateHistory function`).green());
  console.log('------------------------------------------------\n');
}
async function testValue() {
  console.log('' + colorIt(`Starting testValue function`).indigo());

  const dataBL = defaultData.blocklistConfig;
  const dataAdblock = defaultData.adblockConfig;
  const dataAdult = defaultData.adultfilterConfig;
  for (let i = 0; i < dataBL.length; i++) {
    if (dataBL[i].value > dataBL.length) {
      console.log('' + colorIt('found value greater than index size at \n').red());
      console.log(dataBL[i]);
      process.exit(1);
    }
    for (let j = i + 1; j < dataBL.length; j++) {
      if (dataBL[i].value == dataBL[j].value) {
        console.log('' + colorIt('Quitting after finding first instance of repetition at\n').red());
        console.log(dataBL[i]);
        console.log(dataBL[j]);
        process.exit(1);
      }
    }
  }
  for (let x in dataAdblock) {
    if (dataAdblock[x] > dataBL.length) {
      console.log('' + colorIt(`Found value greater than blocklist index in adblock config ${dataAdblock[x]}`).red());
      process.exit(1);
    }
  }
  for (let x in dataAdult) {
    if (dataAdult[x] > dataBL.length) {
      console.log(
        '' + colorIt(`Found value greater than blocklist index in adult filter config ${dataAdult[x]}`).red()
      );
      process.exit(1);
    }
  }
  console.log('' + colorIt(`Finished testValue function`).green());
  console.log('------------------------------------------------\n');
}
async function testCore() {
  console.log('' + colorIt(`Starting testCore function`).indigo());

  const dataBL = defaultData.blocklistConfig;
  const validFilterTypeValues = ['b-wild', 'b-norm', 'white', 'fss'];

  for (let x in dataBL) {
    if (dataBL[x].url.length != dataBL[x].filterType.length) {
      console.log('' + colorIt('Mismatch url and filtertype length. Missing parameters at \n').red());
      console.log(dataBL[x]);
      process.exit(1);
    }
    for (let y in dataBL[x].filterType) {
      if (!validFilterTypeValues.includes(dataBL[x].filterType[y])) {
        console.log('' + colorIt('Invalid filter type value found at \n').red());
        console.log(dataBL[x]);
        process.exit(1);
      }
    }
  }
  console.log('' + colorIt(`Finished testCore function`).green());
  console.log('------------------------------------------------\n');
}

async function testURLs() {
  console.log('' + colorIt(`Starting url checks`).indigo());
  let failed = 0;
  const dataBL = defaultData.blocklistConfig;
  for (let x in dataBL) {
    for (let y in dataBL[x].url) {
      try {
        const res = await fetch(dataBL[x].url[y], { method: 'HEAD' });
        if (res.status !== 200) {
          console.log('' + colorIt(`Error: ${res.status} for ${dataBL[x].url[y]}`).redBg());
          failed += 1;
        }
      } catch (err) {
        console.log('' + colorIt(`Error: ${err} for ${dataBL[x].url[y]}`).redBg());
        failed += 1;
      }
    }
  }

  if (failed > 0) {
    console.log(`${failed} number of urls failed`);
    process.exit(1);
  } else {
    console.log('' + colorIt(`All URLs are working`).green());
  }
  console.log('------------------------------------------------\n');
}
async function main() {
  await downloadFiles();
  await processFiles();
  await copyFiles();
  await generateConfigs();
  await checkFiles();
  await updateHistory();
}
export {
  processFiles,
  downloadFiles,
  copyFiles,
  generateConfigs,
  checkFiles,
  updateHistory,
  testValue,
  testCore,
  testURLs,
  main,
};
