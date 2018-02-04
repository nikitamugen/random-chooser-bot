const mongodb = require('mongodb').MongoClient;
const assert = require('assert');
const hash = require('object-hash');

const ObjectID = require('mongodb').ObjectID;

class AddressSetup {
    constructor(address, listName) {
        assert.notEqual(address, null);
        assert.notEqual(listName, null);
        this.address = address;
        this.listName = listName;
        this.hash = hash(this);
    }

    getAddress() {
        return this.address;
    }
    getAddressString() {
        return JSON.stringify(this.address);
    }

    getListName() {
        return this.listName;
    }

    getHash() {
        return this.hash;
    }
}

class AddressFilter {
    constructor() {
        this.details = {};
    }
    addressSetup(addressSetup) {
        assert.notEqual(addressSetup, null);

        return this.hash(addressSetup.getHash());
    }
    id(id) {
        assert.notEqual(id, null);
        this.details['_id'] = new ObjectID(id);

        return this;
    }
    hash(hash) {
        assert.notEqual(hash, null);
        this.details.hash = hash;

        return this;
    }
    address(address) {
        assert.notEqual(address, null);
        this.details.address = JSON.stringify(address);

        return this;
    }
    listName(listName) {
        assert.notEqual(listName, null);
        this.listName = listName;

        return this;
    }
    getDetails() {
        return this.details;
    }
}

class AddressExistsException {
    constructor(addressItem) {
        this.addressItem = addressItem;
    }

    // Override
    toString() {
        return `Adress item with list name ${addressItem.listName} is already exists.`;
    }
}

class Addresses {
    constructor() {
        this.connectionInfo = {
            url:       process.env.mongodbUrl,
            user:      process.env.mongodbUser,
            password:  process.env.mongodbPassword,
            dbname:    'random-chooser'
        }
        this.url = this.connectionInfo.url;
        this.url = this.url.replace(/\<dbuser\>/i, this.connectionInfo.user);
        this.url = this.url.replace(/\<dbpassword\>/i, this.connectionInfo.password);
    }

    connect() {
        console.log("connection url:", this.url);
        return new Promise((resolve, reject) => {
            mongodb.connect(this.url, (err, client) => {
                if (err) {
                    reject(err);
                }
                this.client = client;
                this.db = client.db(this.connectionInfo.dbname);
                resolve(this.db);
            });
        });
    }

    find(addressFilter) {
        assert.notEqual(addressFilter, null);
        return new Promise((resolve, reject) => {
            this.db.collection('channels').findOne(addressFilter.getDetails(), (err, addressItem) => {
                if (err) {
                    reject(err);
                }
                resolve(addressItem);
            });
        });
    }
    findAll(addressFilter) {
        assert.notEqual(addressFilter, null);
        return new Promise((resolve, reject) => {
            this.db.collection('channels').find(addressFilter.getDetails()).toArray((err, addressItems) => {
                if (err) {
                    reject(err);
                }
                resolve(addressItems);
            });
        });
    }

    insert(addressSetup) {
        assert.notEqual(addressSetup, null);
        const addressFilter = new AddressFilter().hash(addressSetup.getHash());

        return this.find(addressFilter)
        .then(addressItem => {
            if (addressItem) {
                throw new AddressExistsException(addressItem);
            }
            return this._insertInternal(addressSetup);
        });
    }

    _insertInternal(addressSetup) {
        const item = {
            hash:       addressSetup.getHash(),
            address:    addressSetup.getAddressString(),
            listName:   addressSetup.getListName()
        }
        return new Promise((resolve, reject) => {
            this.db.collection('channels').insert(item, (err, payload) => {
                if (err) {
                    reject(err);
                }
                const addressItem = payload.ops[0];
                resolve(addressItem);
            });
        });
    }

    remove(addressFilter) {
        assert.notEqual(addressFilter, null);
        return new Promise((resolve, reject) => {
            this.db.collection('channels').remove(addressFilter.getDetails(), (err, payload) => {
                if (err) {
                    reject(err);
                }
                resolve(payload);
            })
        });
    }
}

module.exports = {
  AddressSetup: AddressSetup,
  AddressFilter: AddressFilter,
  Addresses: Addresses
};