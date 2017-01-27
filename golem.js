'use strict';

/*
** Tools
*/

function log(message) {
    // create a html container with golem_logs as an ID to have logs printed
    var x = new Date();
    var t = x.getHours() + ":" + x.getMinutes() + ":" + (x.getSeconds() < 10 ? "0" + x.getSeconds() : x.getSeconds());
    message = t + " " + message;
    // $("#golem_logs").prepend(message+"<br>");
    console.log(message);
}

/*
** Framework
*/
var lang_fr = "fr-fr";
var lang_en = "en-us";

var proxy_url      = "api.golem.ai";
var proxy_tcp_port = 3003;
var proxy_ws_port  = 3004;

var golem_log_no_config = false;

function golem_no_config(client, data)
{
    if (golem_log_no_config)
    {
    	log(client.name + " no config for " + data.type + ":");
    	console.log(data);
    }
}

var config = {
    // authentication
    "authentication_status": golem_no_config,
    //common
    "handshake": golem_no_config, 
    "confirm_identity": golem_no_config,
    "error": golem_no_config,
    // Front
    "answer": golem_no_config,
    "confirm_request": golem_no_config,
    "confirm_set_fixed_time": golem_no_config,
    "request": golem_no_config,
    "say": golem_no_config,
    "call": golem_no_config,
    // Target
    "confirm_interaction": golem_no_config,
    "confirm_interaction_array": golem_no_config,
    "confirm_delete_interaction": golem_no_config,
    "confirm_enable_interaction": golem_no_config,
    "confirm_disable_interaction": golem_no_config,
    "confirm_enable_interaction_array": golem_no_config,
    "confirm_disable_interaction_array": golem_no_config,
    "confirm_say_to_all": golem_no_config,
    "confirm_say": golem_no_config,
    "confirm_enable_all_but": golem_no_config,
    "confirm_disable_all_but": golem_no_config
};

var golem_log_no_config_core = false;

function golem_no_config_core(client, evt)
{
    if (golem_log_no_config_core)
    {
    	log(client.name + " : no config_core for :");
    	console.log(evt);
    }
}

var config_core = {
    "on_open":golem_no_config_core,
    "on_error":golem_no_config_core,
    "on_message":golem_no_config_core,
    "on_close":golem_no_config_core,
    "on_send":golem_no_config_core,
    "on_request":golem_no_config_core
};

function merge_config(base_config, user_config)
{
    var config_final = {};

    for (var attr in base_config)
    	config_final[attr] = base_config[attr];

    if (typeof user_config == 'object' && user_config != null)
    	for (var attr in user_config)
    	    config_final[attr] = user_config[attr];

    return config_final;
}

class GolemCore {
    /*
    ** Public
    */
    constructor(token, config_core_user, config_user) {
    	this.config_core = merge_config(config_core, config_core_user);
    	this.config = merge_config(config, config_user);
    	this.identity = 'unidentified';
    	this.name = '*newborn*';
    	this.token = token;
        
        this.connected = false;
        var host = "ws://" + proxy_url + ":" + proxy_ws_port;
        this.socket = new WebSocket(host);
        var client = this;
        
        this.socket.onopen = function(evt) {
            client.connected = true;
            client.authentication();
    	    var onOpenFct = client.config_core["on_open"];
    	    if (typeof onOpenFct == 'function')
    		    onOpenFct(client, evt);
        };
        this.socket.onerror = function(evt) {
            client.connected = false;
    	    var onErrorFct = client.config_core["on_error"];
    	    if (typeof onErrorFct == 'function')
    		    onErrorFct(client, evt);
        };
        this.socket.onmessage = function(evt) {
            client.last_packet_received = evt;
    	    var onMsgFct = client.config_core["on_message"];
    	    if (typeof onMsgFct == 'function')
    		    onMsgFct(client, evt);
            client.parsing(evt.data);
        };
        this.socket.onclose = function(evt) {
            client.connected = false;
    	    var onCloseFct = client.config_core["on_close"];
    	    if (typeof onCloseFct == 'function')
    		    onCloseFct(client, evt);
        };
    }
    
    send(message) {
        message = JSON.stringify(message);
        this.send_txt(message);
    }
    
    send_txt(message) {
        this.socket.send(message);
        this.last_packet_sent = message;
        var call = this.config_core["on_send"];
        if (typeof call == 'function')
	        call(this, message);
    }
    
    close() {
    	return this.socket.close();
    }
    
    /*
    ** Private
    */
    authentication() {
        this.send({
    	    type:"authentication",
    	    token: this.token
    	});
    }
    
    identify(identity, name, id_session) {
    	this.name = name;
        this.send({
    	    type:"identity",
    	    category:identity,
    	    id_session:id_session,
    	    name: name
    	});
    	this.identity = identity + "_not_confirmed";
    }
    
    parsing(msg) {
        var obj = JSON.parse(msg);
        var key = obj.type;
    	if (key == "confirm_identity")
            this.identity = obj.category;
        var call = this.config[key];
        if (typeof call != 'function' && call != null) {
            console.log("Received unknown action ", key, " in ", this.identity);
            console.log("Msg->", msg);
            return ;
        }
    	else if (typeof call == 'function' && call != null)
            call(this, obj);
    	else
    	    log("Cannot manage message of type : "+key);
    }
}

class GolemFront extends GolemCore {
    identify(name, id_session) {
        super.identify("front", name, id_session);
    }
    
    sendRequest(lang, text) {
    	var request = {
    	    type:"request",
    	    language:lang,
    	    text:text
    	};
    	this.send(request);
        var call = this.config_core['on_request'];
        if (typeof call == 'function')
	        call(this, request);
    }
    
    setFixedTime(year, month, day, h, m, s) {
        this.send({
    	    type:"set_fixed_time",
    	    year:year,
    	    month:month,
    	    day:day,
    	    hour:h,
    	    minute:m,
    	    seconde:s
    	});
    }
}

class GolemTarget extends GolemCore {
    identify(name, id_session) {
        super.identify("target", name, id_session);
    }
    
    interactionArray(array) {
        this.send({
    	    type:"interaction_array",
    	    interactions:array
    	});
    }
    
    interaction(inter) {
        inter.type = "interaction"
        this.send(inter);
    }
    
    deleteInteraction(id) {
        this.send({
    	    type:"delete_interaction",
    	    id_interaction: id,
    	});
    }
    
    enableInteraction(id) {
        this.send({
    	    type:"enable_interaction",
    	    id_interaction: id,
    	});
    }
    
    disableInteraction(id) {
        this.send({
    	    type:"disable_interaction",
    	    id_interaction: id,
    	});
    }
}

class GolemFrontAndTarget extends GolemCore {
    //Specific
    identify(name, id_session) {
        super.identify("front_and_target", name, id_session);
    }
    
    sendRequest(lang, text) {
	    var request = {
    	    type:"request",
    	    language:lang,
    	    text:text
    	};
        this.send(request);
        var call = this.config_core['on_request'];
        if (typeof call == 'function')
	        call(this, request);
    }
    
    setFixedTime(year, month, day, h, m, s) {
        this.send({
    	    type:"set_fixed_time",
    	    year:year,
    	    month:month,
    	    day:day,
    	    hour:h,
    	    minute:m,
    	    seconde:s
    	});
    }
    
    interactionArray(array) {
        this.send({
    	    type:"interaction_array",
    	    interactions:array
    	});
    }
    
    interaction(inter) {
        inter.type = "interaction"
        this.send(inter);
    }
    
    deleteInteraction(id) {
        this.send({
    	    type:"delete_interaction",
    	    id_interaction: id,
    	});
    }
    
    enableInteraction(id) {
        this.send({
    	    type:"enable_interaction",
    	    id_interaction: id,
    	});
    }
    
    disableInteraction(id) {
        this.send({
    	    type:"disable_interaction",
    	    id_interaction: id,
    	});
    }
}
