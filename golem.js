/*
** Tools
*/

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
const lang_fr = "fr-fr";
const lang_en = "en-us";

class GolemCore {
    /*
    ** Public
    */
    constructor(host, port, onOpenFct, onErrorFct, onMsgFct, onCloseFct, onSendFct) {
	this.identity = 'unidentified';
	this.name = '';
        this.call_map = {};
	this.add_parsing_function('send', onSendFct);
        
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
            client.connected = false;
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
    }
    
    send(message) {
        message = JSON.stringify(message);
        this.socket.send(message);
        this.last_packet_sent = message;
        var call = this.call_map['send'];
        if (typeof call == 'function')
	    call(this, message);
    }

    close() {
	return this.socket.close();
    }
    
    /*
    ** Private
    */
    
    identify(identity, name, id_session) {
        this.send({
    	    type:"identity",
    	    category:identity,
    	    id_session:id_session,
    	    name: name
    	});
    	this.identity = identity + "_not_confirmed";
    	this.name = name;
    }
    
    add_parsing_function(key, call) {
        if (typeof call != 'function' && call != null) {
            console.log("warning ! Paramer function call -", key, " is unset");
            return;
        }
        this.call_map[key] = call;
    }
    
    parsing(msg) {
        var obj = JSON.parse(msg);
        var key = obj.type;
	if (key == "identity_confirm")
            this.identity = obj.category;
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
    setParsingFct(identityConfirm, requestConfirm, answer, setFixedTimeOk, onRequest, onError) {
        this.add_parsing_function("identity_confirm", identityConfirm);
        this.add_parsing_function("request_confirm", requestConfirm);
        this.add_parsing_function("answer", answer);
        this.add_parsing_function("set_fixed_time_ok", setFixedTimeOk);
        this.add_parsing_function("request", onRequest);
        this.add_parsing_function("error", onError);
    }
    
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
        var call = this.call_map['request'];
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
    setParsingFct(identityConfirm, call, confirm_interaction, confirm_interaction_array, onError) {
        this.add_parsing_function("identity_confirm", identityConfirm);
        this.add_parsing_function("call", call);
        this.add_parsing_function("confirm_interaction", confirm_interaction);
        this.add_parsing_function("confirm_interaction_array", confirm_interaction_array);
        this.add_parsing_function("error", onError);
    }
    
    identify(name, id_session) {
        super.identify("target", name, id_session);
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
