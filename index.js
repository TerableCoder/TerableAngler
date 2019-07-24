module.exports = function TerableAngler(mod) {
	const command = mod.command || mod.require.command;
	
	let enabled = false,
		selling = false,
		waitingInventory = false,
		getNumAnglerTokens = false,
		timeout = null,
		numAnglerTokens = 0,
		amountBought = 0,
		itemsToProcess = [],
		contactBuy = {},
		contactSell = {},
    	dialogBuy = {},
    	dialogSell = {},
		hooks = [];
		
	function hook(){ hooks.push(mod.hook(...arguments)); }
	
	function unload(){
		enabled = false;
		if(hooks.length){
			for (let h of hooks)
				mod.unhook(h);
			hooks = [];
		}
	}
	
	if(mod.proxyAuthor !== 'caali'){
		const options = require('./module').options
		if(options){
			const settingsVersion = options.settingsVersion
			if(settingsVersion){
				mod.settings = require('./' + (options.settingsMigrator || 'module_settings_migrator.js'))(mod.settings._version, settingsVersion, mod.settings)
				mod.settings._version = settingsVersion
			}
		}
	}
	
	command.add(['teraa', 'tangler', 'teraangler', 'terableangler'], {
    	$default(){
    		enabled = !enabled;
			clearNPC();
			selling = false;
			waitingInventory = false;
			getNumAnglerTokens = false;
        	command.message(`TerableAngler is now ${enabled ? "enabled" : "disabled"}.`);
			if(enabled) command.message("Talk to Angler Token Vendor, then talk to summoned merchant");
			if(enabled) load();
			else unload();
    	},
		id(x){
			x = parseInt(x);
    		if(!isNaN(x)){
    			mod.settings.initialDelay = x;
    			command.message(`Initial Delay is ${mod.settings.initialDelay}.`);
    		}
		},
		aid(x){
			x = parseInt(x);
    		if(!isNaN(x)){
    			mod.settings.addItemDelay = x;
    			command.message(`Add Item Delay is ${mod.settings.addItemDelay}.`);
    		}
		},
		tbnc(x){
			x = parseInt(x);
    		if(!isNaN(x)){
    			mod.settings.timeBetweenNpcContacts = x;
    			command.message(`Time Between Npc Contacts is ${mod.settings.timeBetweenNpcContacts}.`);
    		}
		},
		clear(){
			clearNPC();
			command.message(`Contacted NPCs cleared.`);
		},
		clean(){
			clearNPC();
			command.message(`Contacted NPCs cleaned.`);
		},
		start(number){
			amountBought = 0;
			load();
			selling = false;
			waitingInventory = false;
			getNumAnglerTokens = false;
			if(!contactBuy.gameId || !contactSell.gameId || !dialogBuy.id|| !dialogSell.id) {
				mod.toClient('S_CHAT', 2, { channel: 21, authorName: 'TA', message: "You haven't opened the dialog windows of both NPCs!!! Clearing... Talk to the Angler Token Vendor, then the summoned merchant."});
				clearNPC();
			} else{
				startBuying(); 
			}
		}
	});
	
	function clearNPC(){
		contactBuy = {};
		contactSell = {};
		dialogBuy = {};
		dialogSell = {};
	}
	
	mod.hook('S_LOGIN', 13, (event) => {
		enabled = false;
		selling = false;
		waitingInventory = false;
		getNumAnglerTokens = false;
		timeout = null;
		itemsToProcess = [];
		clearNPC();
		unload();
    });
	
	function load(){
		if(!hooks.length){
			hook('C_NPC_CONTACT', 2, event => {
				if(!contactBuy.gameId){ Object.assign(contactBuy, event); }
				else if(!contactSell.gameId){ Object.assign(contactSell, event); }
			});
			
			hook('C_DIALOG', 1, event => {
				if(!dialogBuy.id){ Object.assign(dialogBuy, event); }
				else if(!dialogSell.id){ Object.assign(dialogSell, event); }
			});
			
			hook('S_INVEN', 18, event => {
				if(waitingInventory){
					for (const item of event.items){ // add items
						if(206005 == item.id) itemsToProcess.push({id: item.id, slot: item.slot});
					}
					if(!event.more){
						waitingInventory = false;
						processItemsToSell();
					}
				} else if(getNumAnglerTokens){
					for (const item of event.items){
						if(204051 == item.id && item.amount > numAnglerTokens) numAnglerTokens = item.amount;
					}
					if(!event.more){
						getNumAnglerTokens = false;
						if(900 > numAnglerTokens){ 
							command.message("You're out of Angler Tokens. Stopping..."); 
							unload();
						} else{ processItemsToBuy(); }
					}
				}
			});
			
			hook('S_REQUEST_CONTRACT', 1, event => {
				if(!contactBuy.gameId || !contactSell.gameId  || !dialogBuy.id || !dialogSell.id) return;
				if(selling && event.type === 9){ // 9 = merchant, fishing or crystal
					if(itemsToProcess.length > 0){
						let delay = mod.settings.initialDelay;
						sortSlot();
						let item = itemsToProcess[0];
						timeout = mod.setTimeout(() => {
							mod.toServer('C_STORE_SELL_ADD_BASKET', 1, {
								cid: mod.game.me.gameId,
								npc: event.id,
								item: item.id,
								quantity: 300,
								slot: item.slot
							});
						}, delay);
						delay += mod.settings.addItemDelay;
						itemsToProcess = itemsToProcess.slice(18);
						timeout = mod.setTimeout(() => {
							mod.toServer('C_STORE_COMMIT', 1, { gameId: mod.game.me.gameId, contract: event.id });
						}, delay);
					} else{
						selling = false;
						mod.toServer('C_CANCEL_CONTRACT', 1, {
							type: 9,
							id: event.id
						});
						clearTimeout(timeout);
						timeout = setTimeout(startBuying, mod.settings.timeBetweenNpcContacts); // sell -> buy
					}
				} else if(!selling && event.type === 20){ // 20 = angler token
					if(!amountBought){ // buy more
						let delay = mod.settings.initialDelay;
						timeout = mod.setTimeout(() => {
							mod.toServer('C_MEDAL_STORE_BUY_ADD_BASKET', 1, {
								gameId: mod.game.me.gameId,
								contract: event.id,
								item: 206005,
								amount: 300
							});
						}, delay);
						amountBought++;
						delay += mod.settings.addItemDelay;
						timeout = mod.setTimeout(() => {
							mod.toServer('C_MEDAL_STORE_COMMIT', 1, { gameId: mod.game.me.gameId, contract: event.id });
						}, delay);
					} else{
						amountBought = 0;
						selling = true;
						mod.toServer('C_CANCEL_CONTRACT', 1, {
							type: 20,
							id: event.id
						});
						clearTimeout(timeout);
						timeout = setTimeout(startSelling, mod.settings.timeBetweenNpcContacts); // buy -> sell
					}
				}
			});
		}
	}
	

	function startSelling(){ // get item slots
		if(contactBuy.gameId && contactSell.gameId && dialogBuy.id && dialogSell.id) {
			itemsToProcess = [];
			waitingInventory = true;
			mod.toServer('C_SHOW_INVEN', 1, {unk: 1});
		} else{
			command.message("You haven't opened the dialog windows of both NPCs!!! Clearing... Please try again.");
			clearNPC();
		}
	}
	
	function startBuying(){ // get numAnglerTokens
		if(contactBuy.gameId && contactSell.gameId && dialogBuy.id && dialogSell.id) {
			getNumAnglerTokens = true;
			numAnglerTokens = 0;
			mod.toServer('C_SHOW_INVEN', 1, {unk: 1});
		} else{
			command.message("You haven't opened the dialog windows of both NPCs!!! Clearing... Please try again.");
			clearNPC();
		}
	}
	
	function processItemsToSell(){ // contact npc
		mod.toServer('C_NPC_CONTACT', 2, contactSell);
		let dialogHook;
		
		clearTimeout(timeout);
		timeout = mod.setTimeout(() => {
			if (dialogHook) {
				mod.unhook(dialogHook);
				command.message('Failed to contact npc. Stopping...');
				unload();
			}
		}, 5000);

		dialogHook = mod.hookOnce('S_DIALOG', 2, event => {
			mod.clearTimeout(timeout);
			mod.toServer('C_DIALOG', 1, Object.assign(dialogSell, { id: event.id }));
		});
	}
	
	function processItemsToBuy(){ // contact npc
		mod.toServer('C_NPC_CONTACT', 2, contactBuy);
		let dialogHook;
		
		clearTimeout(timeout);
		timeout = mod.setTimeout(() => {
			if(dialogHook){
				mod.unhook(dialogHook);
				command.message('Failed to contact npc. Stopping...');
				unload();
			}
		}, 5000);

		dialogHook = mod.hookOnce('S_DIALOG', 2, event => {
			mod.clearTimeout(timeout);
			mod.toServer('C_DIALOG', 1, Object.assign(dialogBuy, { id: event.id }));
		});
	}
	
	function sortSlot(){
        itemsToProcess.sort(function (a, b){
            return Number(a.slot) - Number(b.slot);
        });
    }
}