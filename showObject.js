const lib = require('./lib');

(async() => {
    const args = process.argv.slice(2)
    if(args.length === 0) {
        throw new Error('need to specify a location of a JSON object to merge and show');
    }
    await lib.showObject(args[0]);
})()