const {ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, Intents, MessageActionRow, GatewayIntentBits } = require('discord.js');
const { token, guild_id, channel_id, text_message} = require('./config.json');

const fs = require('fs');

const CSV_FILE = 'roles.csv';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
})

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try{
        const guild = await client.guilds.fetch(guild_id);
        const channel = await guild.channels.fetch(channel_id);
        await deleteAllMessagesInChannel(channel);
    
        const messages = await createButtonsFromCSV();
        for (const message of messages) {
            await channel.send(message);
        }
    }catch(e){
        console.error(e);
    }
    
});

// Generates a list of buttons, rows, and messages from the CSV file.
async function createButtonsFromCSV() {
    const buttons = [];
    const fileContent = fs.readFileSync(CSV_FILE, 'utf8').split('\n');
    const rows = fileContent.map(row => row.split(','));

    const messages = [];
    let currentMessage = { content: text_message, components: [] };
    let currentActionRow = new ActionRowBuilder();

    for (let i = 0; i < rows.length; i++) {
        const [roleName, buttonName] = rows[i];

            // Validate roleName and buttonName
        if (!roleName || !buttonName) {
            console.error(`Invalid data in CSV at line ${i + 1}: roleName="${roleName}", buttonName="${buttonName}"`);
            continue; // Skip this iteration if data is invalid
        }

        const button = new ButtonBuilder()
            .setCustomId(roleName)
            .setLabel(buttonName)
            .setStyle(ButtonStyle.Primary);

        currentActionRow.addComponents(button);

        if (currentActionRow.components.length === 5) {
            currentMessage.components.push(currentActionRow);
            currentActionRow = new ActionRowBuilder();
        }

        if (currentMessage.components.length === 5 || i === rows.length - 1) {
            messages.push(currentMessage);
            currentMessage = { content: null, components: [] };
        }
    }

    return messages;
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    try {
        await interaction.deferReply({ ephemeral: true }); // Acknowledge the interaction

        const { member, guild } = interaction;
        const role = guild.roles.cache.find(role => role.name === interaction.customId);

        if (!role) {
            await interaction.editReply({ content: 'Role not found.' }); // Use editReply to send the response
            console.error(`Role not found: ${interaction.customId}`);
            return;
        }

        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            console.log(`Role ${role.name} removed from user ${member.displayName}`);
            await interaction.editReply({ content: `Role "${role.name}" removed.` }); // Use editReply here
        } else {
            await member.roles.add(role);
            console.log(`Role ${role.name} added to user ${member.displayName}`);
            await interaction.editReply({ content: `Role "${role.name}" added.` }); // Use editReply here
        }
    } catch (e) {
        console.error(e);
    }
});



async function deleteAllMessagesInChannel(channel) {
    try {
        const fetchedMessages = await channel.messages.fetch({ limit: 100 }); // Fetch up to 100 messages
        await channel.bulkDelete(fetchedMessages); // Delete fetched messages
    } catch (error) {
        console.error('Error deleting messages:', error);
    }
}

client.login(token);