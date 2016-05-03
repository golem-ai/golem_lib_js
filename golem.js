
const lang_fr = "french"
const lang_en = "english"

class GolemCore {
    /*
    ** Public
    */
    constructor(onOpenFct, onErrorFct, onMsgFct, onCloseFct) {
        this.connected = false
        this.socket.onopen = function(evt) {
            this.connected = true
            onOpenFct(evt, this)
        };
        this.socket.onerror = function(evt) {
            onErrorFct(evt, this)
        };
        this.socket.onmessage = function(evt) {
            this.last_packet_received = evt
            onMsgFct(evt, this)
            this.parsing(evt.data)
        };
        this.socket.onclose = function(evt) {
            this.connected = false
            onCloseFct(evt, this)
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
    
    connect(host, port, identity, name) {
        var host = "ws://" + host + ":" + port;
        this.socket = new WebSocket(host);
        this.golem_send({
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
            return 
        }
        call(this, obj)
    }
    
    get last_packet_sent() {
        return this.last_packet_sent
    }
    
    get last_packet_received() {
        return this.last_packet_received
    }
}


class GolemFront extends GolemCore {
    
    setParsingFct(requestConfirm, answer, setFixedTimeOk) {
        this.add_parsing_function("request_confirm", requestConfirm)
        this.add_parsing_function("answer", requestConfirm)
        this.add_parsing_function("set_fixed_time_ok", setFixedTimeOk)
    }
    
    sendRequest(lang, text) {
        this.golem_send({
    	    type:"request",
    	    language:lang,
    	    text:text
    	});
    }
    
    setFixedTime(year, month, day, h, m s) {
        this.golem_send({
    	    type:"set_fixed_time",
    	    year:year,
    	    month:month,
    	    day:day,
    	    hour:h,
    	    minute:m,
    	    seconde:s
    	});
    }
    
    connect(host, port, name) {
        this.super.connect(host, port, "front", name)
    }
}


/*
** OLD
*/


var last_packet_sent;
var last_answer_received;
var last_call_received;
var last_command;
var last_language;

function create_json_insatisfaction() {
    var json = {
        url: "<" + window.location.href + ">",
        name: golem_project_name,
        websocket_port: websocket_port,
        last_packet_sent: last_packet_sent,
        last_answer_received: last_answer_received,
        last_call_received: last_call_received,
        last_command: last_command,
        last_language: last_language,
        user_agent: navigator.userAgent
    };
    return json;
}

$("#unsatisfied_button").click(function(event) {
    $("#unsatisfied_button").addClass('disabled');
    var data = create_json_insatisfaction();
    var message = '';
    $.each(data, function(index, value) {
        message += index + " : " + value + "\n";
    });
    message += "================================";
    var json = {
        payload: JSON.stringify({
            text: message
        })
    };
    $.post("https://hooks.slack.com/services/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", json, function(data) {
        $.rustaMsgBox({
            fadeOut: false,
            closeButton: true,
            content: "Votre rapport d'erreur a bien été pris en compte. Merci.",
            mode: 'success',
            bottom: '150px',
            fadeTimer: 4000
        });
    });
    return false;
});



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
