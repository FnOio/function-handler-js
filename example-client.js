const fnHub = require('./functionHub-library')('https://fno.io/hub/api');

function printFunctions(functions) {
  console.log(`This query found ${functions.length} possible functions:`);
  functions.forEach((func) => console.log(`\t${func.func.name}`));
}

function printParameters(func) {
  const { expects, returns } = func.func;
  console.log({ expects, returns });
}

const query = {
  expects: [{ type: 'float' }, { type: 'float' }],
  returns: { type: 'float' },
};

async function main() {
  console.log('Query without keyword filter:');
  let queryResult = await fnHub.doQuery(query);
  printFunctions(queryResult);

  query.keywords = ['total population'];

  console.log('\nQuery with keyword filter:');
  printFunctions(await fnHub.doQuery(query));

  // This is the one
  const totalPopulationFunction = (await fnHub.doQuery(query))[0];

  console.log('\nFunction parameters info:');
  printParameters(totalPopulationFunction);

  const populationDensity = 363.6;
  const totalArea = 30528.0;
  const totalPopulationImplementation = (await fnHub.getImplementationsFromFunction(
    totalPopulationFunction,
  ))[0];
  console.log(`\nThe total population of Belgium is: ${totalPopulationImplementation(populationDensity, totalArea)}`);

  console.log("\nNew query, let's find indent function.");
  const indentQuery = {
    expects: [{ type: 'string' }, { type: 'integer' }],
    returns: { type: 'string' },
    keywords: ['indent'],
  };
  queryResult = await fnHub.doQuery(indentQuery);
  printFunctions(queryResult);

  console.log(
    'Let\'s call its implementation on the string "Hey" with the additional parameter "8":',
  );
  const indentImplementation = (await fnHub.getImplementationsFromFunction(
    queryResult[0],
  ))[0];

  console.log(indentImplementation('Hey', 8));

  console.log("\nNew query, let's find left-pad function.");
  const leftpadQuery = {
    expects: [{ type: 'string' }, { type: 'integer' }],
    returns: { type: 'string' },
    keywords: ['left-pad'],
  };
  queryResult = await fnHub.doQuery(leftpadQuery);
  printFunctions(queryResult);

  console.log('Let\'s call its implementation on the string "Hey" with the additional parameter "5":');
  let leftpadImplementations = [];
  const start = async () => {
    await asyncForEach(queryResult, async (q) => {
      const impls = await fnHub.getImplementationsFromFunction(q);
      leftpadImplementations = leftpadImplementations.concat(impls);
    });

    console.log(`Found ${leftpadImplementations.length} implementations:`);
    leftpadImplementations.forEach((imp, i) => {
      console.log('\tOutput of implementation', i, ':', imp('Hey', 5));
    });
  };

  start();
}

main().catch(console.error);

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
