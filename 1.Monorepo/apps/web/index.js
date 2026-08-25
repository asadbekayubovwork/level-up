import { button } from '@repo/ui'
import assert from 'node:assert'

assert.equal(button('Save'), '[ Save ]')
console.log('web ok:', button('Save'))
