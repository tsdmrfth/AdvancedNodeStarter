const mongoose = require('mongoose')
const redis = require('redis')
const util = require('util')
const keys = require('../config/keys')
const redisClient = redis.createClient(keys.redisUrl)

redisClient.hget = util.promisify(redisClient.hget)

const exec = mongoose.Query.prototype.exec

mongoose.Query.prototype.cache = function (options = {}) {
    this.cacheData = true
    this.rootCacheKey = JSON.stringify(options.key || '')
    return this
}

mongoose.Query.prototype.exec = async function () {
    if (!this.cacheData) {
        return exec.apply(this, arguments)
    }

    const cacheKey = JSON.stringify(Object.assign({}, this.getQuery(), {
        collection: this.mongooseCollection.name
    }))

    const cachedValue = await redisClient.hget(this.rootCacheKey, cacheKey)

    if (cachedValue) {
        const doc = JSON.parse(cachedValue)
        return Array.isArray(doc)
            ? doc.map(d => new this.model(d))
            : new this.model(doc)
    }

    const result = await exec.apply(this, arguments)
    redisClient.hset(this.rootCacheKey, cacheKey, JSON.stringify(result))

    return result
}

module.exports = {
    clearCache(key) {
        redisClient.del(JSON.stringify(key))
    }
}