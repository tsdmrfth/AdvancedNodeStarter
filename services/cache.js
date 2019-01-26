const mongoose = require('mongoose')
const redis = require('redis')
const redisUrl = 'redis://127.0.0.1:6379'
const redisClient = redis.createClient(redisUrl)
const util = require('util')
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