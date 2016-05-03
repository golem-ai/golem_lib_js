
const lang_fr = "french"
const lang_en = "english"

class GolemCore {
    /*
    ** Public
    */
    constructor(host, port, onOpenFct, onErrorFct, onMsgFct, onCloseFct) {
        this.call_map = {}
        this.connected = false
        var host = "ws://" + host + ":" + port;
        this.socket = new WebSocket(host);
        var client = this
        this.socket.onopen = function(evt) {
            client.connected = true
            onOpenFct(evt, client)
        };
        this.socket.onerror = function(evt) {
            onErrorFct(evt, client)
        };
        this.socket.onmessage = function(evt) {
            client.last_packet_received = evt
            onMsgFct(evt, client)
            client.parsing(evt.data)
        };
        this.socket.onclose = function(evt) {
            client.connected = false
            onCloseFct(evt, client)
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
    
    identify(identity, name) {
        this.send({
    	    type:"identity",
    	    category:identity,
    	    version:1,
    	    revision:0,
    	    name: name
    	});
    }
    
    add_parsing_function(key, call) {
        if (typeof call != 'function') {
            console.log("warning ! Paramer function call -", key, " is unset")
            return
        }
        this.call_map[key] = call
    }
    
    parsing(msg) {
        msg = msg.substring(8);
        var obj = JSON.parse(msg);
        var key = obj.type
        var call = this.call_map[key]
        if (typeof call != 'function') {
            console.log("Received unknown action ", key, " in ", this.identity)
            console.log("Msg->", msg)
            return 
        }
        call(this, obj)
    }
}


class GolemFront extends GolemCore {
    
    setParsingFct(requestConfirm, answer, setFixedTimeOk) {
        this.add_parsing_function("request_confirm", requestConfirm)
        this.add_parsing_function("answer", requestConfirm)
        this.add_parsing_function("set_fixed_time_ok", setFixedTimeOk)
    }
    
    identify(name) {
        super.identify("front", name)
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


/*
** OLD
*/



function golem_work(socket, language, query) {
    var message = {
        type: "request",
        language: language,
        text: query
    };
    last_command = query
    last_language = language
    golem_data_request(message);
    golem_send(socket, message);
}

function golem_send(socket, message) {
    message = JSON.stringify(message);
    var len = pad8(byteLength(message));
    log(socket.golem_type + " : Sending Message(" + len + ") : " + message);
    socket.send(len + message);
    last_packet_sent = message;
}

function golem_connect(host, port, type, context) {
    var host = "ws://" + host + ":" + port;

    socket = new WebSocket(host);

    socket.golem_type = type;

    if (type == 'target')
        socket.onerror = function(evt) {
            $.rustaMsgBox({
                fadeOut: false,
                closeButton: true,
                content: "Impossible de se connecter à " + host,
                mode: 'error',
                bottom: '150px',
                fadeTimer: 4000
            });
        };

    socket.onmessage = function(evt) {
        log(type + " : Received Message: " + evt.data);

        var data = evt.data.substring(8);
        data = JSON.parse(data);

        if (data.type == "call") {
            last_call_received = evt.data;
            golem_data_response(data);
            log("Calling : " + calls[data.id].name + " (id:" + data.id + ", args:" + JSON.stringify(data.params) + ")");
            calls[data.id].call(data.params);
        }
        else if (data.type == "answer") {
            last_answer_received = evt.data;
            golem_data_response(data);
        }
    };
    socket.onclose = function(evt) {
        log(type + " : Connection closed.");
    };
    socket.onopen = function(evt) {
        log(type + " : Connection opened.");

        golem_send(this, {
            type: "identity",
            category: type,
            idsession: context,
            version: golem_project_version,
            revision: golem_project_revision,
            name: golem_project_name + "_" + type
        });

        if (this.golem_type == "target") {
            calls.forEach(function(element, index, array) {
                golem_send(this, {
                    type: "interaction",
                    category: "action",
                    id: index,
                    name: element.golem_name,
                    descriptor: element.golem_descriptor,
                    args: element.golem_args,
                });
            }, this);
        }
        else if (this.golem_type == "front") {
            // Used to run tests, function must be defined in projet file
            golem_tests(this);
        }
    };
    return socket;
}

function golem_init(host, port, context) {
    var socket_target = golem_connect(host, port, "target", context);
    var socket_front = golem_connect(host, port, "front", context);

    return socket_front;
}
