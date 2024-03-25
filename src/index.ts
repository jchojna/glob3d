import WebGLobe from './js/globe';
import { getRandomInt } from './js/globeHelpers';

let worldInstance = null;
const updateButton = document.querySelector('.update-button');
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

const createWorld = async () => {
  const { results } = await getResults(1000);
  const inputData = getInputData(results);
  worldInstance = new WebGLobe(100, 3, 0.2, 5, true);
  worldInstance.initialize(inputData);
};

const testAsync = async () => {
  await createWorld();
};

testAsync();

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

updateButton.addEventListener('click', () => {
  worldInstance.clean();

  fetch(facetsUrl)
    .then((res) => res.json())
    .then(({ facets }) => {
      const genusData = facets[0].counts;
      const randomGenusIdx = getRandomInt(0, genusData.length);
      return genusData[randomGenusIdx].name;
    })
    .then((genus) => {
      fetch(getGenusDataUrl(baseGbifUrl, genus, 1))
        .then((res) => res.json())
        .then(({ results }) => {
          fetch(getWikiUrl(results[0].genus))
            .then((res) => res.json())
            .then(({ query }) => {
              const { pages } = query;
              Object.values(pages).forEach((value) => {
                const { source } = value.thumbnail;
                source ? console.log(source) : false;
              });
            })
            .catch((error) => console.log(error));
        })
        .catch((error) => console.log(error));

      fetch(getGenusDataUrl(baseGbifUrl, genus, 1000))
        .then((res) => res.json())
        .then(({ results }) => {
          const inputData = getInputData(results);
          if (inputData.length > 0) worldInstance.update(inputData);
        });
      return genus;
    });
});
