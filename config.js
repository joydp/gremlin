var config = {}

//Azure commercial cloud configurtion ----------------
config.endpoint = process.env.DB_ENDPOINT;
config.primaryKey = process.env.DB_PRIMARY_KEY;
//Azure commercial cloud configurtion end ----------------

//config.database = "persons"
//config.collection = "graphdb"

config.database = "offset"
config.collection = "india"

module.exports = config;
