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

  return `${url.protocol}//${url.hostname}${url.pathname}`
}