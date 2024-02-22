const http = require('http');
const lib = require('./lib');

const sui = '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '  <head>\n' +
    '    <meta charset="utf-8" />\n' +
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    '    <meta\n' +
    '      name="description"\n' +
    '      content="SwaggerUI"\n' +
    '    />\n' +
    '    <title>UE API BUILDER</title>\n' +
    '    <link href="https://assets-global.website-files.com/63ddcf880e4a61a502e3f165/63fbaa5d3efb721efd4b1af0_Favicon.png" rel="shortcut icon" type="image/x-icon">\n' +
    '    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />\n' +
    '  </head>\n' +
    '  <body>\n' +
    '  <div id="swagger-ui"></div>\n' +
    '  <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js" crossorigin></script>\n' +
    '  <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-standalone-preset.js" crossorigin></script>\n' +
    '  <script>\n' +
    '    window.onload = () => {\n' +
    '      window.ui = SwaggerUIBundle({\n' +
    '        url: \'/openapi.json\',\n' +
    '        dom_id: \'#swagger-ui\',\n' +
    '        presets: [\n' +
    '          SwaggerUIBundle.presets.apis,\n' +
    '          SwaggerUIStandalonePreset\n' +
    '        ],\n' +
    '        layout: "StandaloneLayout",\n' +
    '      });\n' +
    '    };\n' +
    '  </script>\n' +
    '  </body>\n' +
    '</html>'

const redoc = '<!DOCTYPE html>\n' +
    '<html>\n' +
    '  <head>\n' +
    '    <title>UE API BUILDER DOCS</title>\n' +
    '    <link href="https://assets-global.website-files.com/63ddcf880e4a61a502e3f165/63fbaa5d3efb721efd4b1af0_Favicon.png" rel="shortcut icon" type="image/x-icon">\n' +
    '    <!-- needed for adaptive design -->\n' +
    '    <meta charset="utf-8"/>\n' +
    '    <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">\n' +
    '\n' +
    '    <!--\n' +
    '    Redoc doesn\'t change outer page styles\n' +
    '    -->\n' +
    '    <style>\n' +
    '      body {\n' +
    '        margin: 0;\n' +
    '        padding: 0;\n' +
    '      }\n' +
    '    </style>\n' +
    '  </head>\n' +
    '  <body>\n' +
    '    <redoc spec-url=\'/openapi.json\'></redoc>\n' +
    '    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"> </script>\n' +
    '  </body>\n' +
    '</html>'

http.createServer( async function (req, res) {
    if(req.url.includes('/openapi.json')) {
        const json = await lib.buildSwag();
        res.writeHead(200);
        res.end(JSON.stringify(json));
    } else if(req.url.includes('/doc')) {
        res.writeHead(200);
        res.end(redoc);
    } else {
        res.writeHead(200);
        res.end(sui);
    }
}).listen(3000);