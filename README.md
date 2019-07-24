# TerableAngler

teraa -> teraa start -> teraa

Put the "C_STORE_COMMIT.1.def" file into your  tera-proxy\node_modules\tera-data\protocol\  folder.

Get the Opcodes from https://github.com/TerableCoder/TerableOpcodes

REMOVE item-cache module, otherwise this module will not work.


## Usage
### `teraa` 
- Toggles module on or off
- When on, talk to Angler Token Vendor, then talk to a vendor that lets you sell item to it, then type "teraa start"
### `teraa id` 
- Sets Initial Delay, default 400 ms
### `teraa aid` 
- Sets Add Item Delay, default 200 ms
### `teraa tbnc` 
- Sets Time Between Npc Contacts, default 700 ms
### `teraa clear/clean` 
- Clears contacted NPCs
### `teraa start` 
- Buys "Red Angleworm" x300, then vendors them, repeats until you type "teraa"

![](example.gif)
