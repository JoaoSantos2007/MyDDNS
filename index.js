import { exec } from 'child_process'
import { writeFileSync, readFileSync } from 'fs'

// Set control variables
let firstVerify = true
let lastIpv6 = null
let INTERFACE = null
let API_TOKEN = null
let RECORD_NAME = null
let RECORD_ID = null
let ZONE_ID = null

// Try to read settings.json
try {
  const data = readFileSync('settings.json', 'utf8')
  const settings = JSON.parse(data);

  API_TOKEN = settings?.API_TOKEN
  RECORD_ID = settings?.RECORD_ID
  RECORD_NAME = settings?.RECORD_NAME
  ZONE_ID = settings?.ZONE_ID
  INTERFACE = settings.INTERFACE || 'eth0'
  
  if(!API_TOKEN || !RECORD_ID || !ZONE_ID || !INTERFACE || !RECORD_NAME) throw Error('Missing settings.json values')
} catch (err) {
  console.error(err)
  throw Error("It was not possible to read settings.json")
}

// Try to read ipv6.json
try {
  const data = readFileSync('ipv6.json', 'utf8')
  const info = JSON.parse(data);

  lastIpv6 = info?.ipv6
} catch (err) {}

// Update on Cloudflare
async function updateCloudflare(ipv6) {
  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}`;

    const req = {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'AAAA',
        name: RECORD_NAME,
        content: ipv6,
        ttl: 120,
        proxied: false,
      }),
    }

    // Send put req to cloudflare
    await fetch(url, req);

    console.log("Update request sent to Cloudflare!")
  } catch (err) {
    console.error("It was not possible to update on Cloudflare!")
  }
}

// Verify ipv6 changed
function verifyIpv6() {
  // Command to read ipv6
  const command = `ip -6 -o addr show scope global | awk '/dynamic/ && $4 !~ /^fd/ {print $4}' | cut -d/ -f1`
  // const command = `ip -6 -o addr show dev ${INTERFACE} scope global | awk '{print $4}' | cut -d/ -f1 | head -n1`

  exec(command, async (err, stdout) => {
    const actualIpv6 = stdout.trim()

    if(actualIpv6 !== lastIpv6 || firstVerify) {
      writeFileSync('ipv6.json', `{"ipv6": "${actualIpv6}"}`, 'utf8')

      //Update on Cloudflare
      await updateCloudflare(actualIpv6)
      
      firstVerify = false
      lastIpv6 = actualIpv6
    }
  })
}


setInterval(verifyIpv6, 5000);
