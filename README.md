# stm32dfu.js
A library of host [USB DFU](http://wiki.openmoko.org/wiki/USB_DFU) drivers in Javascript utilizing the [WebUSB](https://wicg.github.io/webusb/) draft standard to implement USB firmware updates from the browser.

Base: <a href="https://github.com/devanlai/webdfu">webdfu</a>

## Used

```bash
npm install stm32dfu
```

```javascript
// init and conn
import stm32dfu from 'stm32dfu'
let deviceSettings = stm32dfu.findAllStm32Device(0x0483)  //修改0x0483为对应的vendorId
stm32dfu.getDfu(deviceSettings[0].device, deviceSettings[0])

// load dfu and flash
let dfuFile = stm32dfu.parseDfuImage([Blob])
let flashSetting = {
  logger : {
    debug: (...data) => {console.log(data)},
    info: (...data) => {console.log(data)},
    warn: (...data) => {console.log(data)},
    error: (...data) => {console.log(data)},
  },
  handler: (done, total) => {
    console.log(`${done} / ${total}`)
  }
}
stm32dfu.flash(deviceSettings[0], dfuFile, flashSetting).then()
```

## TODO

- [ ] demo
- [ ] Rewrite using TypeScript

## Demos
### stm32dfu
https://kischang.github.io/stm32dfu/example/

### dfu-util
A demo re-implementing dfu-util functionality in the browser:

https://devanlai.github.io/webdfu/dfu-util/

