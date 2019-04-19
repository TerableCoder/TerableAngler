module.exports = function TerableAngler(mod) {
	const command = mod.command || mod.require.command;
	let enabled = false,
		selling = false,
		waitingInventory = false,
		getNumAnglerTokens = false,
		timeout = null,
		numAnglerTokens = 0,
		amountToBuy = 0,
		amountBought = 0,
		gameId = 0n,
		itemsToProcess = [],
		contactBuy = {},
		contactSell = {},
    	dialogBuy = {},
    	dialogSell = {};
	
	command.add(['teraa', 'tangler', 'teraangler', 'terableangler'], {
    	$default(){
    		enabled = !enabled;
			clearNPC();
			selling = false;
			waitingInventory = false;
			getNumAnglerTokens = false;
        	command.message(`TerableAngler is now ${enabled ? "enabled" : "disabled"}.`);
			if(enabled) command.message("Talk to Angler Token Vendor, then talk to summoned merchant");
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
			//number = parseInt(number);
			//if (isNaN(number) || number < 8) {
			//	command.message(`Please specify number of open inventory slots > 7`);
			//	return;
			//}
			//amountToBuy = parseInt(number/8); // buy 8 inventory slots at a time
			amountToBuy = 1; // buy 8 inventory slots at a time
			amountBought = 0;
			enabled = true;
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
	
	mod.hook('S_LOGIN', mod.majorPatchVersion >= 81 ? 13 : 12, event => {
        gameId = event.gameId;
		enabled = false;
		selling = false;
		waitingInventory = false;
		getNumAnglerTokens = false;
		timeout = null;
		itemsToProcess = [];
		clearNPC();
    });
	
	mod.hook('C_NPC_CONTACT', 2, event => {
		if(!enabled) return;
		if(!contactBuy.gameId){ Object.assign(contactBuy, event); }
		else if(!contactSell.gameId){ Object.assign(contactSell, event); }
	});
	
	mod.hook('C_DIALOG', 1, event => {
		if(!enabled) return;
		if(!dialogBuy.id){ Object.assign(dialogBuy, event); }
		else if(!dialogSell.id){ Object.assign(dialogSell, event); }
	});
	
	mod.hook('S_INVEN', 18, event => {
		if(!enabled) return;
		if(waitingInventory){
			for (const item of event.items){ // add items
				if(204200 == item.id) itemsToProcess.push({id: item.id, slot: item.slot});
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
				if(amountToBuy*100 > numAnglerTokens){ 
					enabled = false;
					command.message("You're out of Angler Tokens. Stopping..."); 
				} else{ processItemsToBuy(); }
			}
		}
	});


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
				enabled = false;
				mod.unhook(dialogHook);
				command.message('Failed to contact npc. Stopping...');
			}
		}, 5000);

		dialogHook = mod.hookOnce('S_DIALOG', 2, event => {
			mod.clearTimeout(timeout);
			mod.toServer('C_DIALOG', 1, Object.assign(dialogBuy, { id: event.id }));
		});
	}

	mod.hook('S_REQUEST_CONTRACT', 1, event => {
		if(!enabled || !contactBuy.gameId || !contactSell.gameId  || !dialogBuy.id || !dialogSell.id) return;
		if(selling && event.type === 9){ // 9 = merchant, fishing or crystal
			if(itemsToProcess.length > 0){
				let delay = 400;
				sortSlot();
				let item = itemsToProcess[0];
				timeout = mod.setTimeout(() => {
					mod.toServer('C_STORE_SELL_ADD_BASKET', 1, {
						cid: gameId,
						npc: event.id,
						item: item.id,
						quantity: 80,
						slot: item.slot
					});
				}, delay);
				delay += 200;
				itemsToProcess = itemsToProcess.slice(8);
				timeout = mod.setTimeout(() => {
					mod.toServer('C_STORE_COMMIT', 1, { gameId, contract: event.id });
				}, delay);
			} else{
				selling = false;
				mod.toServer('C_CANCEL_CONTRACT', 1, {
					type: 9,
					id: event.id
				});
				clearTimeout(timeout);
				timeout = setTimeout(startBuying, 700); // sell -> buy
			}
		} else if(!selling && event.type === 20){ // 20 = angler token
			if(amountToBuy > amountBought){ // buy more
				let delay = 200;
				timeout = mod.setTimeout(() => {
					mod.toServer('C_MEDAL_STORE_BUY_ADD_BASKET', 1, {
						gameId: gameId,
						contract: event.id,
						item: 204200,
						amount: 80
					});
				}, delay);
				amountBought++;
				delay += 200;
				timeout = mod.setTimeout(() => {
					mod.toServer('C_MEDAL_STORE_COMMIT', 1, { gameId, contract: event.id });
				}, delay);
			} else{
				amountBought = 0;
				selling = true;
				mod.toServer('C_CANCEL_CONTRACT', 1, {
					type: 20,
					id: event.id
				});
				clearTimeout(timeout);
				timeout = setTimeout(startSelling, 700); // buy -> sell
			}
		}
	});
	
	function sortSlot(){
        itemsToProcess.sort(function (a, b){
            return Number(a.slot) - Number(b.slot);
        });
    }
}