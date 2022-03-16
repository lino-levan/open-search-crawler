import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker'
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import resizeImg from 'resize-img'
import { processLink } from './lib'

const uri = process.env.MONGO_URI as string

puppeteer.use(StealthPlugin())
puppeteer.use(AdblockerPlugin())

async function main() {
  const client = new MongoClient(uri)
  await client.connect()

  const raw = client.db("opensearch").collection("raw")
  const images = client.db("opensearch").collection("images")

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9,hy;q=0.8'
  })

  await page.setViewport({
    width: 1920,
    height: 1080,
  })

  let links = ['https://www.youtube.com']

  while(true) {
    try{
      if(links.length === 0)
        break

      const link = processLink(links[0])

      let alreadySearched = await raw.findOne({ href: link })

      console.log(link)

      if(!link || alreadySearched) {
        links.shift()
        continue
      }

      await page.goto(link, {waitUntil: 'networkidle2'})

      const fullRes: Buffer = await page.screenshot({type: 'png'}) as Buffer
      const screenshotBuffer = await resizeImg(fullRes, { width: 384, height: 216 })
      let title = await page.title()
      const description = await page.$eval("head > meta[name='description']", (element: any) => element.content).catch(err=>"")
      const fullText = await page.$eval("body", (element: any) => element.innerText).catch(err=>"")

      if(title.length === 0) {
        title = await page.$$eval('h1', (h: any) => h.innerText) as any

        console.log("Proposed title", title)
        links.shift()
        continue
      }

      let hrefs: string[] = await page.$$eval('a', as => as.map((a: any) => a.href)) as any

      hrefs = hrefs.filter((str)=>str.length>0)

      links = [...links, ...hrefs]

      links.shift()

      let imgs: any[] = await page.$$eval('img', images => images.map((i: any) => ({alt: i.alt, src: i.src, width: i.width, height: i.height}))) as any

      imgs = imgs.map((img)=>(
        {
          ...img,
          href: link,
          title: title,
          description: description,
          numLinks: hrefs.length,
        }
      ))

      await raw.insertOne({
        href: link,
        title: title,
        description: description,
        numLinks: hrefs.length,
        fullText: fullText,
        screenshot: `data:image/png;base64,${screenshotBuffer.toString('base64url')}`,
        version: "1.2"
      })

      if(imgs.length > 0) {
        await images.insertMany(imgs)
      }
    }
    catch(err) {
      console.log(err)
      links.shift()
      continue
    }
  }

  await browser.close()
  await client.close()
}

main()