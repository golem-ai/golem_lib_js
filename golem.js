/*
** Tools
*/

function pad8(num) {
    var s = "00000000" + num;
    return s.substr(s.length - 8);
}

function byteLength(str) {
    // returns the byte length of an utf8 string
    var s = str.length;
    for (var i = str.length - 1; i >= 0; i--) {
        var code = str.charCodeAt(i);
        if (code > 0x7f && code <= 0x7ff) s++;
        else if (code > 0x7ff && code <= 0xffff) s += 2;
        if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
    }
    return s;
}

function log(message) {
    // create a html container with golem_logs as an ID to have logs printed
    x = new Date();
    t = x.getHours() + ":" + x.getMinutes() + ":" + (x.getSeconds() < 10 ? "0" + x.getSeconds() : x.getSeconds());
    message = t + " " + message;
    // $("#golem_logs").prepend(message+"<br>");
    console.log(message);
}


/*
** Framework
*/
const lang_fr = "french";
const lang_en = "english";

class GolemCore {
    /*
    ** Public
    */
    constructor(host, port, onOpenFct, onErrorFct, onMsgFct, onCloseFct) {
        this.call_map = {};
        this.call_map["identity_confirm"] = this.identityConfirm;
        
        this.connected = false;
        var host = "ws://" + host + ":" + port;
        this.socket = new WebSocket(host);
        var client = this;
        
        this.socket.onopen = function(evt) {
            client.connected = true;
	    if (typeof onOpenFct == 'function')
		onOpenFct(client, evt);
        };
        this.socket.onerror = function(evt) {
	    if (typeof onErrorFct == 'function')
		onErrorFct(client, evt);
        };
        this.socket.onmessage = function(evt) {
            client.last_packet_received = evt;
	    if (typeof onMsgFct == 'function')
		onMsgFct(client, evt);
            client.parsing(evt.data);
        };
        this.socket.onclose = function(evt) {
            client.connected = false;
	    if (typeof onCloseFct == 'function')
		onCloseFct(client, evt);
        };
    };
    
    send(message) {
        message = JSON.stringify(message);
        var len = pad8(byteLength(message)); // Header see protocol
        this.socket.send(len + message);
        this.last_packet_sent = message;
    }
    
    /*
    ** Private
    */
    
    identify(identity, name, id_session) {
        this.send({
    	    type:"identity",
    	    category:identity,
    	    id_session:id_session,
    	    version:1,
    	    revision:0,
    	    name: name
    	});
    	this.identity = identity + "_not_confirmed";
    }
    
    identityConfirm(client, obj) {
        client.identity = obj.category;
    }
    
    add_parsing_function(key, call) {
        if (typeof call != 'function' && call != null) {
            console.log("warning ! Paramer function call -", key, " is unset");
            return;
        }
        this.call_map[key] = call;
    }
    
    parsing(msg) {
        msg = msg.substring(8);
        var obj = JSON.parse(msg);
        var key = obj.type;
        var call = this.call_map[key];
        if (typeof call != 'function' && call != null) {
            console.log("Received unknown action ", key, " in ", this.identity);
            console.log("Msg->", msg);
            return ;
        }
	else if (call != null)
            call(this, obj);
    }
}


class GolemFront extends GolemCore {
    
    setParsingFct(requestConfirm, answer, setFixedTimeOk) {
        this.add_parsing_function("request_confirm", requestConfirm);
        this.add_parsing_function("answer", answer);
        this.add_parsing_function("set_fixed_time_ok", setFixedTimeOk);
    }
    
    identify(name, id_session) {
        super.identify("front", name, id_session);
    }
    
    sendRequest(lang, text) {
        this.send({
    	    type:"request",
    	    language:lang,
    	    text:text
    	});
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
    
    setParsingFct(call, confirm_interaction, confirm_interaction_array) {
        this.add_parsing_function("call", call);
        this.add_parsing_function("confirm_interaction", confirm_interaction);
        this.add_parsing_function("confirm_interaction_array", confirm_interaction_array);
    }
    
    identify(name, id_session) {
        super.identify("front", name, id_session);
    }
    
    interactionArray(array) {
        this.send({
    	    type:"interaction_array",
    	    interactions:array
    	});
    }
    
    interaction(interaction) {
        interaction.type = "interaction"
        this.send(interaction);
    }
    
    delInteraction(idInt, idStr) {
        this.send({
    	    type:"interaction_array",
    	    id_interaction: idInt,
    	    id_str_interaction: idStr
    	});
    }
}
