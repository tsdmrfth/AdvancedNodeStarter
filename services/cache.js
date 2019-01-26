const mongoose = require('mongoose')
const redis = require('redis')
const redisUrl = 'redis://127.0.0.1:6379'
const redisClient = redis.createClient(redisUrl)
const util = require('util')
redisClient.get = util.promisify(redisClient.get)

const exec = mongoose.Query.prototype.exec

mongoose.Query.prototype.exec = async function () {
    const cacheKey = JSON.stringify(Object.assign({}, this.getQuery(), {
        collection: this.mongooseCollection.name
    }))

    const cachedValue = await redisClient.get(cacheKey)

    if (cachedValue) {
        const doc = JSON.parse(cachedValue)
        return Array.isArray(doc)
            ? doc.map(d => new this.model(d))
            : new this.model(doc)
    }

    const result = await exec.apply(this, arguments)
    redisClient.set(cacheKey, JSON.stringify(result))

    return result
}