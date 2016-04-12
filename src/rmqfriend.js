var amqp = require('amqplib/callback_api');
var Promise = require('bluebird');
var util    = require('./util');

/**
 * @name          RMQFriend
 *
 * @description   An instance of the class will provide a friendly api
 *                which will be easier to work with.
 */

function RMQFriend(queue,options){
	this.queue               = queue;
	this.options             = options;
	this.connection          = null;
	this.channel             = null;
	this.listenercallscache  = [];
	this.queuecallscache     = [];
	this.arrangeConfOptions();
}

/**
 * @name        connect
 *
 * @description This method is used to connect to rabbitmq server.
 *              it returns a promise.
 *
 * @param       {String} url Rabbitmq server url.
 *
 * @returns     {Promise}
 */

RMQFriend.prototype.connect = function connect(url){

	var self = this;

	return new Promise(function(resolve,reject){
		amqp.connect(url,function connect(err,conn){
			if(err){
				reject(err);
				return;
			}
			self.connection = conn;
			resolve(conn);
		});
	})
	.then(function(){
		return self.createChannel();
	});

};

/**
 * @private
 *
 * @name        createChannel
 *
 * @description This method used to create a channel to rabbitmq server.
 *              it returns a promise.
 *
 * @returns     {Promise}
 */

RMQFriend.prototype.createChannel = function channel(){

	var self = this;

	if(self.channel){
		return Promise.resolve(self.channel);
	}

	return new Promise(function(resolve,reject){
		self.connection.createChannel(function createChannel(err,channel){
			if(err){
				reject(err);
				return;
			}
			self.channel = channel;
			self.handleCachedQueuesAndListeners();
			resolve(channel);
		});
	});

};

/**
 * @name        send
 *
 * @description This method used to send message data a binary blob to rabbitmq server.
 *              it returns a promise.
 *
 * @returns     {Promise}
 */

RMQFriend.prototype.send = function send(data){

	if(!data){
		return Promise.reject("Please provide proper values to send");
	}

	if(!this.channel){
		this.queuecallscache.push({data:data});
		return Promise.resolve(data);
	}

	data = new Buffer(util.stringify(data));

	this.channel.assertQueue(this.queue,this.queueOptions);
	this.channel.sendToQueue(this.queue,data,this.msgOptions);

	Promise.resolve(data);

};

/**
 * @name                      registerHandler
 *
 * @description               This method used to register queue consumers.
 *                            it returns a promise.
 *
 * @param {Function} callback A callback function which is invoked every time there
 *                            is a message available to process and it should always
 *                            return a promise.
 */


RMQFriend.prototype.registerHandler = function registerHandler(callback){

	var self = this;

	if(!callback){
		return Promise.reject("Provided listener is not a function");
	}

	if(!this.channel){
		this.listenercallscache.push({ callback : callback });
		return Promise.resolve();
	}

	var callbackWrapper = function(){
		var args = [].slice.call(arguments,0);
		callback.apply(null,arguments)
		.then(function(){
			if(!self.options.noAck){
				self.channel.ack(args[0]);
			}
		});
	}

	this.channel.assertQueue(this.queue,this.queueOptions);
	this.channel.consume(this.queue,callbackWrapper,this.listenerOptions);

};

/**
 * @name                      handleCachedQueuesAndListeners
 *
 * @description               This method used to cache all the message send to queues
 *                            and listeners registered till the channel is created after
 *                            that we will send cached messages to the queues and also
 *                            register the consumer callbacks to the queues.
 *
 */

RMQFriend.prototype.handleCachedQueuesAndListeners = function handleCachedQueuesAndListeners(){
	var self = this;

	this.queuecallscache.map(function(queueInfo){
		self.send(queueInfo.data);
	});

	this.listenercallscache.map(function(listenerInfo){
		self.registerHandler(listenerInfo.callback);
	});

	this.queuecallscache    = [];
	this.listenercallscache = [];

};

/**
 * @private
 *
 * @name                      arrangeConfOptions
 *
 * @description               This method used to arrange configuration options values
 *                            into respective categories.
 *
 */


RMQFriend.prototype.arrangeConfOptions = function arrangeConfOptions(){

	this.queueOptions = {
		durable : this.options.durable
	};

	this.msgOptions = {
		persistent : this.options.persistent
	};

	this.listenerOptions = {
		noAck : this.options.noAck
	};

}

module.exports = function instantiate(queue,options){
	return new RMQFriend(queue,options);
};