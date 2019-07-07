// Github:   https://github.com/shdwjk/Roll20API/blob/master/WildDice/WildDice.js
// By:       The Aaron, Arcane Scriptomancer
// Contact:  https://app.roll20.net/users/104025/the-aaron

var WildDice = WildDice || (function() {
    'use strict';

    var version = '0.3.2',
        lastUpdate = 1490872135,

	ch = function (c) {
		var entities = {
			'<' : 'lt',
			'>' : 'gt',
			"'" : '#39',
			'@' : '#64',
			'{' : '#123',
			'|' : '#124',
			'}' : '#125',
			'[' : '#91',
			']' : '#93',
			'"' : 'quot',
			'-' : 'mdash',
			' ' : 'nbsp'
		};

		if(_.has(entities,c) ){
			return ('&'+entities[c]+';');
		}
		return '';
	},

    checkInstall = function() {
        log('-=> WildDice v'+version+' <=-  ['+(new Date(lastUpdate*1000))+']');
    },

    showHelp = function(who) {

        sendChat('','/w "'+who+'" '+
'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'+
	'<div style="font-weight: bold; border-bottom: 1px solid black;font-size: 130%;">'+
		'WildDice v'+version+
	'</div>'+
	'<div style="padding-left:10px;margin-bottom:3px;">'+
		'<p>WildDice implements the rolling mechanics for WildDice systems.</p>'+
	'</div>'+
	'<b>Commands</b>'+
	'<div style="padding-left:10px;">'+
		'<b><span style="font-family: serif;">!wd '+ch('[')+ch('<')+'Dice Expression'+ch('>')+ch('|')+'--help'+ch(']')+'</span></b>'+
		'<div style="padding-left: 10px;padding-right:20px">'+
			'<p>Rolls the WildDice expression and diplays the results. <b>!wwd</b> can be used in place of <b>!wd</b> to whisper the results to the GM.</p>'+
			'<ul>'+
				'<li style="border-top: 1px solid #ccc;border-bottom: 1px solid #ccc;">'+
					'<b><span style="font-family: serif;">'+ch('<')+'Dice Expression'+ch('>')+'</span></b> '+ch('-')+' An inline dice expression, something akin to '+ch('[')+ch('[')+'5d6+8'+ch(']')+ch(']')+' which will then be parsed for the roll result.'+
				'</li> '+
				'<li style="border-top: 1px solid #ccc;border-bottom: 1px solid #ccc;">'+
					'<b><span style="font-family: serif;">--help</span></b> '+ch('-')+' Shows the Help screen'+
				'</li> '+
			'</ul>'+
		'</div>'+
    '</div>'+
'</div>'
        );
    },

    getDiceCounts = function(rolls) {
        return ( _.reduce(rolls || [], function(m,r){
                m[r]=m[r]+1||1;
                return m;
            },{}));
    },

    getDiceArray = function(c) {
        return _.reduce(c,function(m,v,k){
            _.times(v,function(){m.push(k);});
            return m;
        },[]);
    },

    isOrlonD6CallbackCmd = function(msg) {
        return msg.type == "general" && msg.content.startsWith('<div class="orlonCallback" style="display: none;">');
    },
    
    isOrlonD6ApiCmd = function(msg) {
        return msg.type == "api" && 
        msg.content && 
        (
            msg.content.startsWith("!wd") || 
            msg.content.startsWith("!wwd") || 
            msg.content.startsWith("!wt")
        );
    },
    
    getWho = function(msg) {
        return "" + (getObj('player',msg.playerid)||{get:()=>'API'}).get('_displayname');
    },

    getDiceFromSubroll = function(roll) {
        return roll.expr ? [] : _.pluck( roll.results || [], 'v');
    },

    getDiceFromRollCallback = function(msg) {
         // 0 => dice, 1 => operator (always +), 2 => wildDice result, 3 => pips
        var retDice = getDiceFromSubroll(msg.inlinerolls[0].results.rolls[0]);
        var retWildDice = getDiceFromSubroll(msg.inlinerolls[0].results.rolls[2]);
        
        return [retDice, retWildDice];
    },
    
    parseMISCInfo = function(msg) {
        if (!msg.content) return;
        var content = msg.content;
        var myRegexp = /###(.*?)###/g;
        var match = myRegexp.exec(content);
        return JSON.parse(match[1]);
    },
    
    ProcessCallback = function(msg) {
        
        var args, who,
            w=false, wildDie,
            rDice = [], wildDices = [], 
            bonusDice = [],
            critFailDice = [],
            markFirstMax = false,
            sum = 0, sumFail = 0,
            pips = 0, 
            critFail = false,
            MISCInfos = {};
        
        MISCInfos = parseMISCInfo(msg);
        log(MISCInfos);
        w = MISCInfos.w ? MISCInfos.w : false;
        
        [rDice, wildDices] = getDiceFromRollCallback(msg);
        wildDie = wildDices.shift();
        pips = parseInt(msg.inlinerolls[0].results.rolls[3].expr.substr(1), 10); // Remove the "+" of 3rd roll which expr is the number of pips
        
        if (wildDie == 1) {
            critFail = true;
            critFailDice = getDiceCounts(rDice);
            if (!_.isEmpty(critFailDice))
            {
                critFailDice[_.max(rDice)]--;
                critFailDice = getDiceArray(critFailDice);
                sumFail=_.reduce(critFailDice,function(m,r){return parseInt(m,10) + parseInt(r,10);},0) + pips;
    
                markFirstMax = true;
            }
        }
        
        sum = _.reduce(rDice.concat(wildDices),function(m,r){return m+r;}, wildDie) + pips;

        sendChat(MISCInfos.playerid ? "player|" + MISCInfos.playerid : 'API', (w ? '/w gm ' : '/direct ')+
            '<table style="background: white; border: 1px solid black; width: 100%;">'+
                '<tr style="background: darkblue; border-bottom: 1px solid black; text-align: center;"><td style="padding: 1px 3px; color: white; font-weight: bold;" colspan="2">Jet ' + (MISCInfos.carac ? '- ' + MISCInfos.carac : '') + ' <span style="font-size: 9px;">('+(rDice.length+1)+'D6'+ (pips>0 ? ('+'+pips) : '')+ ')</span></td></tr>' +
                    // Display ND
                    (MISCInfos.nd ? (
                    '<tr style="border: 1px solid black;"><td style="font-weight: bold; padding: 1px 3px;">Difficulté</td><td>'+
                    '<div style="background: white; padding: 5px 3px; font-weight: bold; text-align: center; font-size:20px; color=maroon">' + MISCInfos.nd + '</div>' +
                    '</td></tr>') : '')+
                    '<tr><td style="font-weight: bold; padding: 1px 3px; width:66px;">Jet</td><td>'+
                    // Display normal dices (+ striked one if any)
                    _.map(rDice,function(d){
                            var c ='';
                            if( markFirstMax && d === _.max(rDice) ) {
                                c = 'background-image: linear-gradient(to bottom right,  transparent calc(50% - 1px), red, transparent calc(50% + 1px));';
                                markFirstMax = false;
                            }
                            return '<div style="float:left;background-color: white; '+c+' border: 1px solid #999999;border-radius: 2px;font-weight:bold;padding:1px 5px; margin:1px 3px;">'+d+'</div>';
                        }).join('')+
                        // Display wild dice
                        '<div style="float:left; background-color: '+(critFail ? '#ffadad' : '#e3e3ff')+'; color: black; border: 1px solid #999999;border-radius: 2px;font-weight:bold;padding:1px 5px; margin:1px 3px;">'+wildDie+'</div>'+
                        // Display result of exploding wild dice
                    _.map(wildDices,function(d){
                            return '<div style="float:left;background-color: #e3ffe3; color: black; border: 1px solid #999999;border-radius: 2px;font-weight:bold;padding:1px 5px 0px 5px; margin:1px 3px;">'+d+'</div>';
                        }).join('')+
                        // Display pips
                    (pips ?
    					'<div style="float:left; background-color: yellow; color: black; border: 1px solid #999999;border-radius: 10px;font-weight:bold;padding:1px 5px; margin:1px 8px;">' + ((pips > 0) ? '+ ' : '- ') + Math.abs(pips)+'</div>' :
    					'')+
                    '<div style="clear: both"></div>'+
                    '</td></tr>'+
                    '<tr><td style="margin-left: 10px; font-weight: bold; padding: 1px 3px;">Total</td><td>'+
                    // Display results (totals)
                        '<div style="float:left; margin-left: 10px; background: '+(critFail ? 'orange' : 'green' )+ '; border: 1px solid black; padding: 1px 3px; color: white; font-weight: bold;">'+sum+'</div>'+
                        (critFail ? ('<div style="float:left; background: red; margin-left: 10px; border: 1px solid black; padding: 1px 3px; color: white; font-weight: bold;">'+ sumFail +'</div>') : '')+
                        (MISCInfos.nd ? ('<div style="float:left; margin-left: 10px; color: '+(sum >= MISCInfos.nd ? (critFail && sumFail < MISCInfos.nd ? 'orange' : 'green') : 'red' )+ '; padding: 1px 3px; font-weight: bold;">'+(sum >= MISCInfos.nd ? (critFail && sumFail < MISCInfos.nd ? 'Succès ?' : 'Succès') : 'Echec' ) + '</div>') : '') +
                        '<div style="clear: both"></div>'+
                    '</td></tr>'+
                    
                    (MISCInfos.dmg ? ( '<tr style="border: 1px solid black;"><td style="font-weight: bold; padding: 1px 3px;">Dégâts</td><td>'+
                    '<div style="margin-left: auto ; margin-right: auto; position: relative; text-align:center;">'+
                    '<div style="background: white;padding: 5px 3px;font-weight: bold;font-size: 20px;display: inline-block;">' + (MISCInfos.dmg + (MISCInfos.nd ? Math.floor((sum - MISCInfos.nd)/3) : 0)) + '</div>' +
                    (MISCInfos.nd ? ('<div style="background: white;padding: 5px 3px;font-weight: bold;display: inline-block;font-size: 12px;">= ' + MISCInfos.dmg + ' (+' + Math.floor((sum - MISCInfos.nd)/3) + ')</div>') :'') +
                    '</div>'+
                    '</td></tr>') : '')+
                    // Display Effect
                    (MISCInfos.range ? (
                    '<tr style="border: 1px solid black;"><td style="font-weight: bold; padding: 1px 3px;">Portée</td><td>'+ //
                    '<div style="background: white; padding: 5px 3px; text-align: center; font-weight: bold; font-size:18px; color=maroon">' + MISCInfos.range + '</div>' +
                    '</td></tr>') : '')+
                    // Display Effect
                    (MISCInfos.effect ? (
                    '<tr style="border: 1px solid black;"><td style="font-weight: bold; padding: 1px 3px;">Autres effets</td><td>'+
                    '<div style="background: white; padding: 5px 3px; text-align: center; font-size:12px; color=maroon">' + MISCInfos.effect + '</div>' +
                    '</td></tr>') : '')+
                    // Display Effect
                    (MISCInfos.desc ? (
                    '<tr style="border: 1px solid black;"><td colspan = "2">'+ //<td style="font-weight: bold; padding: 1px 3px;">Description</td>
                    '<div style="background: white; padding: 5px 3px; text-align: center; font-size:12px; font-style: italic; color=maroon">' + MISCInfos.desc + '</div>' +
                    '</td></tr>') : '')+
                '</table>');
    },

    EvalArithmetics = function(s) {
        return (s.replace(/\s/g, '').match(/[+\-]?([0-9\.]+)/g) || [])
            .reduce(function(sum, value) {
                return parseFloat(sum) + parseFloat(value);
            }, 0);
    },

    ParseArguments = function(content) {
        log(content);
        var myRegexp = /{{(.*?)=(.*?)}}/g;
        var match;
        var nd = null, damage = null, carac = null, effect = null, description = null, range = null;
        while (match = myRegexp.exec(content))
        {
            if (match[1] && match[2])
            {
                switch(match[1])
                {
                    case "nd":
                        nd = parseInt(EvalArithmetics(match[2]), 10);
                        if (!nd || nd === 0)
                            nd = null;
                        break;
                    case "damage":
                        damage = parseInt(EvalArithmetics(match[2]), 10);
                        if (!damage || damage === 0)
                            damage = null;
                        break;
                    case "carac":
                        carac = match[2];
                        if (!carac || carac.trim() === "")
                            carac = null;
                        break;
                    case "range":
                            range = match[2];
                        if (!range || range.trim() === "")
                            range = null;
                        break;
                    case "description":
                        description = match[2];
                        if (!description || description.trim() === "")
                            description = null;
                        break;
                    case "effect":
                        effect = match[2];
                        if (!effect || effect.trim() === "")
                            effect = null;
                        break;
                }
            }
        }
        return [carac, nd, damage, description, effect, range];
    },

    ProcessApiMessage = function(msg) {
        var args, who,
            w=false, 
            errorDie, wildDie,
            rDice = [], 
            initialDiceNb = 0,
            pips = 0, 
        
        who = getWho(msg);
        
        log("==== Triggered D6 Api Cmd ====");
        
        args = msg.content.split(" ");
        if(!msg.inlinerolls || _.contains(args,'--help')){
            showHelp(who);
            return;
        }
        
        w = args[0] == "!wwd";
        
        rDice = [];
        if (msg.inlinerolls)
        {
            // Get all dice roll in a tab
            rDice = _.flatten(_.map(msg.inlinerolls[0].results.rolls, function(roll) { 
                
                if (roll.expr)
                    return [];
                return _.pluck( roll.results || [], 'v');
            }));
            
            // Pips = Get pips
            pips = ((msg.inlinerolls && msg.inlinerolls[0].results.total-_.reduce(rDice,function(m,r){return m+r;},0)) || 0);
    
            initialDiceNb = rDice.length;
            log("Rolling " + initialDiceNb + " dice");
            
            var MISCInfo = {};
            MISCInfo['w'] = w;
            MISCInfo['playerid'] = msg.playerid;
            [MISCInfo['carac'], MISCInfo['nd'], MISCInfo['dmg'], MISCInfo['desc'], MISCInfo['effect'], MISCInfo['range']] = ParseArguments(msg.content);
            log(MISCInfo);
            
            sendChat( "player|" + msg.playerid, '<div class="orlonCallback" style="display: none;">[['+(initialDiceNb-1)+'D6+1D6!+'+pips+']]###' + JSON.stringify(MISCInfo) + '###</div>', null, {use3d : true});
        }
    },

    handleInput = function(msg) {
        // Handle stuff
        if (isOrlonD6CallbackCmd(msg)) {
            ProcessCallback(msg);
        }
        else if (isOrlonD6ApiCmd(msg)) {
            ProcessApiMessage(msg);
        }
    },

    registerEventHandlers = function() {
        on('chat:message', handleInput);
    };

    return {
        CheckInstall: checkInstall,
        RegisterEventHandlers: registerEventHandlers
    };
    
}());

on('ready',function() {
    'use strict';

    WildDice.CheckInstall();
    WildDice.RegisterEventHandlers();
});