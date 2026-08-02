const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, GatewayIntentBits } = require('discord.js');
const { token, guild_id, channel_id, text_message } = require('./config.json');

const fs = require('fs');

const CSV_FILE = 'roles.csv';
const MESSAGE_IDS_FILE = 'message_ids.json';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
})

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
        const guild = await client.guilds.fetch(guild_id);
        const channel = await guild.channels.fetch(channel_id);
        const newMessages = await createButtonsFromCSV();
        const savedIds = loadMessageIds();

        if (savedIds.length > 0) {
            const updated = await tryEditMessages(channel, savedIds, newMessages);
            if (updated) {
                console.log('Messages updated successfully.');
                return;
            }
            console.log('Saved messages no longer exist, posting fresh.');
        }

        const postedIds = [];
        for (const message of newMessages) {
            const sent = await channel.send(message);
            postedIds.push(sent.id);
        }
        saveMessageIds(postedIds);
        console.log('Messages posted successfully.');
    } catch (e) {
        console.error(e);
    }
});

function loadMessageIds() {
    try {
        return JSON.parse(fs.readFileSync(MESSAGE_IDS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveMessageIds(ids) {
    fs.writeFileSync(MESSAGE_IDS_FILE, JSON.stringify(ids));
}

async function tryEditMessages(channel, savedIds, newMessages) {
    const existingMessages = [];
    for (const id of savedIds) {
        try {
            existingMessages.push(await channel.messages.fetch(id));
        } catch {
            return false;
        }
    }

    if (existingMessages.length !== newMessages.length) {
        for (const msg of existingMessages) {
            await msg.delete().catch(() => {});
        }
        return false;
    }

    for (let i = 0; i < existingMessages.length; i++) {
        await existingMessages[i].edit(newMessages[i]);
    }
    return true;
}

function createButtonsFromCSV() {
    const fileContent = fs.readFileSync(CSV_FILE, 'utf8').split('\n');
    const rows = fileContent.map(row => row.split(','));

    const messages = [];
    let currentMessage = { content: text_message, components: [] };
    let currentActionRow = new ActionRowBuilder();

    for (let i = 0; i < rows.length; i++) {
        const [roleName, buttonName] = rows[i];

        if (!roleName || !buttonName) {
            console.error(`Invalid data in CSV at line ${i + 1}: roleName="${roleName}", buttonName="${buttonName}"`);
            continue;
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
            if (currentActionRow.components.length > 0) {
                currentMessage.components.push(currentActionRow);
                currentActionRow = new ActionRowBuilder();
            }
            messages.push(currentMessage);
            currentMessage = { content: null, components: [] };
        }
    }

    return messages;
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    try {
        await interaction.deferReply({ ephemeral: true });

        const { member, guild } = interaction;
        const role = guild.roles.cache.find(role => role.name === interaction.customId);

        if (!role) {
            await interaction.editReply({ content: 'Role not found.' });
            console.error(`Role not found: ${interaction.customId}`);
            return;
        }

        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            console.log(`Role ${role.name} removed from user ${member.displayName}`);
            await interaction.editReply({ content: `Role "${role.name}" removed.` });
        } else {
            await member.roles.add(role);
            console.log(`Role ${role.name} added to user ${member.displayName}`);
            await interaction.editReply({ content: `Role "${role.name}" added.` });
        }
    } catch (e) {
        console.error(e);
    }
});

client.login(token);
