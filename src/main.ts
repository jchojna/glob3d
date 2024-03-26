import WebGLobe from './js/globe';
import { getRandomInt } from './js/globeHelpers';
import './style.css';

const baseGbifUrl = 'https://api.gbif.org/v1/occurrence/search';
const facetsUrl = `${baseGbifUrl}?kingdomKey=1&phylumKey=44&classKey=212&facet=genusKey&genusKey.facetLimit=1200000&genusKey.facetOffset=0&limit=0`;

const getGenusDataUrl = (baseUrl: string, genus, limit) => {
  return `${baseUrl}?genusKey=${genus}&limit=${limit}`;
};

const getWikiUrl = (title, size = 300) => {
  return `https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&pithumbsize=${size}&origin=*`;
};

const getGenusNumber = async () => {
  const res = await fetch(facetsUrl);
  const { facets } = await res.json();
  const genusData = facets[0].counts;
  const randomGenusIdx = getRandomInt(0, genusData.length);
  return genusData[randomGenusIdx].name;
};

const getResults = async (limit) => {
  const genusNumber = await getGenusNumber();
  const res = await fetch(getGenusDataUrl(baseGbifUrl, genusNumber, limit));
  return await res.json(); // add try catch
};

const getImage = async () => {
  const { results } = await getResults(1);
  const res = await fetch(getWikiUrl(results[0].genus));
  const { query } = await res.json();
  const { pages } = query;
  // Object.values(pages).forEach((value) => {
  //   if (value && value.thumbnail) {
  //     const { source } = value.thumbnail;
  //     return source;
  //   } else {
  //     return '';
  //   }
  // });
};

const getInputData = (dataArr) => {
  return dataArr
    .map(
      ({
        continent,
        country,
        countryCode,
        decimalLatitude,
        decimalLongitude,
        genus,
        kingdom,
        species,
        eventDate,
      }) => {
        return decimalLatitude && decimalLatitude
          ? {
              name: species,
              coordinates: [decimalLatitude, decimalLongitude],
              date: new Date(eventDate),
              country,
              // continent,
              // countryCode,
              // genus,
              // kingdom
            }
          : null;
      }
    )
    .filter((e) => e);
};

const getData = async () => {
  const { results } = await getResults(1000);
  return getInputData(results);
};

const root = document.querySelector('#root');
const updateButton = document.querySelector('.update-button');
if (!root) throw new Error('Root element not found');
const data = await getData();
const globeInstance = new WebGLobe(root, 100, 3, 0.2, 5, true);
globeInstance.initialize(data);

updateButton &&
  updateButton.addEventListener('click', async () => {
    globeInstance.clean();
    const { results } = await getResults(1000);
    const inputData = getInputData(results);
    globeInstance.update(inputData);
  });
