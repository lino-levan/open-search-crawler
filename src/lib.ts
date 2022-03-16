export function processLink(link: string) {
  let url
  try {
    url = new URL(link)
  }
  catch(err) {
    return null
  }

  if(url.protocol !== "https:") {
    return null
  }

  if(url.hostname.includes("youtube.com")) {
    return link
  } else {
    return `${url.protocol}//${url.hostname}${url.pathname}`
  }
}