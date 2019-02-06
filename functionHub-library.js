var rp = require('request-promise');
var http = require('http'),
    vm = require('vm'),
    concat = require('concat-stream'),
    jsonld = require('jsonld'),
    fs = require('fs'),
    npm = require('npm-programmatic'),
    path = require('path'),
    mkdirp = require('mkdirp');

var server = 'http://localhost:4000';

function get_http(url, saveFile, pathToSave) {
    const req = rp(url);
    return req.then(data => {
        if (saveFile) {
            mkdirp(path.dirname(pathToSave), err => {
                if (err) {
                    console.log('WARNING: Could not create cache directory');
                    return;
                }
                fs.writeFile(pathToSave, data, err => {
                    if (err) {
                        console.log(
                            'WARNING: Could not save implementation to disk'
                        );
                    }
                });
            });
        }
        return data;
    });
}

async function http_require(url, saveFile, pathToSave) {
    data = get_http(url, saveFile, pathToSave);
    return eval(await data); // TODO: unsafe!
}

function doQuery(query, javascriptOnly = true) {
    const req = rp(server + '/query', {
        body: Object.assign({}, query),
        json: true,
        method: 'POST'
    });
    return req
        .then(async result => {
            return Promise.all(await convert(result, javascriptOnly));
        })
        .catch(err => console.error(err));
}

function getImplementationFromHub(uri) {
    const req = rp(server + '/implementation', {
        body: { id: uri },
        json: true,
        method: 'POST'
    });
    return req
        .then(async result => {
            graph = await jsonld.expand(result);
            return Promise.all(graph);
        })
        .catch(err => console.error(err));
}

async function convert(jsonldDoc, javascriptOnly) {
    return await jsonldDoc.map(async graph => {
        graph = await jsonld.expand(graph);
        let func = graph.filter(
            node =>
                node['@type'] &&
                node['@type'].indexOf(
                    'http://w3id.org/function/ontology/Function'
                ) !== -1
        )[0];
        let implementations = [];
        if (javascriptOnly) {
            implementations = graph.filter(
                node =>
                    node['@type'] &&
                    node['@type'].indexOf(
                        'http://example.com/functions/JavaScriptImplementation'
                    ) !== -1
            );
        } else {
            implementations = graph.filter(
                node =>
                    node['@type'] &&
                    node['@type'].indexOf(
                        'http://example.com/functions/Implementation'
                    ) !== -1
            );
        }
        const expects = func['http://w3id.org/function/ontology/expects'][0][
            '@list'
        ].map(param => {
            const paramNode = graph.filter(
                node => node['@id'] === param['@id']
            )[0];
            const predicateNode = graph.filter(
                node =>
                    node['@id'] ===
                    paramNode['http://w3id.org/function/ontology/predicate'][0][
                        '@id'
                    ]
            )[0];
            const type =
                predicateNode['http://w3id.org/function/ontology/type'][0][
                    '@id'
                ];
            return type;
        });
        const returns = func['http://w3id.org/function/ontology/returns'].map(
            param => {
                const paramNode = graph.filter(
                    node => node['@id'] === param['@id']
                )[0];
                const predicateNode = graph.filter(
                    node =>
                        node['@id'] ===
                        paramNode[
                            'http://w3id.org/function/ontology/predicate'
                        ][0]['@id']
                )[0];
                const type =
                    predicateNode['http://w3id.org/function/ontology/type'][0][
                        '@id'
                    ];
                return type;
            }
        );
        func = {
            uri: func['@id'],
            name: func['http://w3id.org/function/ontology/name'][0]['@value'],
            description:
                func['http://purl.org/dc/terms/description'][0]['@value'],
            expects,
            returns
        };
        return {
            func,
            implementations,
            graph
        };
    });
}

function urlToFilepath(url) {
    var protocolPat = /.*:\/\//;
    var result = [];
    url = url.replace(protocolPat, '');
    url = url.split('/');
    url = url.map(partial => {
        result = result.concat(partial.split('.').reverse());
    });
    return result.join('/');
}

function getJavaScriptFunctionImplementation(implementation, graph) {
    var localPath =
        'functionHub_implementations/js-function/' +
        urlToFilepath(implementation['@id']) +
        '.js';
    if (fs.existsSync(localPath)) {
        return Promise.resolve(require(path.join(process.cwd(), localPath)));
    } else {
        return http_require(
            implementation['http://usefulinc.com/ns/doap#download-page'][0][
                '@value'
            ],
            true,
            localPath
        );
    }
}

async function getComponentsJSImplementation(implementation, graph) {
    // TODO: find a cleaner way to do this
    // Install package if not already installed
    try {
        require(path.join(
            process.cwd(),
            'node_modules',
            implementation['http://usefulinc.com/ns/doap#name'][0]['@value']
        ));
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            // Install the required package
            await npm.install(
                implementation['http://usefulinc.com/ns/doap#name'][0][
                    '@value'
                ],
                { cwd: process.cwd() }
            );
        } else {
            throw err;
        }
    }

    // Load the component
    const Loader = require('componentsjs').Loader;
    const loader = new Loader({ mainModulePath: process.cwd() });
    fs.writeFileSync('temp.jsonld', JSON.stringify(graph));
    await loader.registerModuleResourcesUrl('temp.jsonld');
    const component = await loader.instantiateManually(
        implementation[
            'https://linkedsoftwaredependencies.org/vocabularies/object-oriented#component'
        ][0]['@id'],
        {}
    );
    return component;
}

function getDownloadImplementation(
    implementation,
    implementation_dir,
    file_extension
) {
    var localPath =
        'functionHub_implementations/' +
        implementation_dir +
        '/' +
        urlToFilepath(implementation['@id']) +
        '.' +
        file_extension;
    if (fs.existsSync(localPath)) {
        return Promise.resolve(true);
    } else {
        return get_http(
            implementation['http://usefulinc.com/ns/doap#download-page'][0][
                '@value'
            ],
            true,
            localPath
        );
    }
}

function getImplementation(implementation, graph) {
    if (
        implementation['@type'].indexOf(
            'https://linkedsoftwaredependencies.org/vocabularies/object-oriented#Module'
        ) !== -1
    ) {
        return getComponentsJSImplementation(implementation, graph);
    } else if (
        implementation['@type'].indexOf(
            'http://example.com/functions/JavaScriptFunction'
        ) !== -1
    ) {
        return getJavaScriptFunctionImplementation(implementation, graph);
    } else if (
        implementation['@type'].indexOf(
            'http://example.com/functions/JavaClass'
        ) !== -1
    ) {
        return getDownloadImplementation(implementation, 'java-class', 'java');
    }
}

function getImplementationsFromFunction(func) {
    const candidates = func.implementations;

    return Promise.all(
        candidates.map(impl => getImplementation(impl, func.graph))
    );
}

module.exports = function(ip) {
    if (ip) {
        server = ip;
    }
    return {
        doQuery,
        getImplementationsFromFunction,
        getImplementation,
        getImplementationFromHub
    };
};
