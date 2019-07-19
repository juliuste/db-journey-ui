'use strict'

const h = require('virtual-dom/h')
const products = require('vbb-util/products')
const ms = require('ms')
const flatten = require('lodash/flatten')

const renderTransferPosition = require('./lib/render-transfer-position')

const cls = 'db-journey-ui-'

const pedestrians = [
	'🚶🏻‍♀️', '🚶🏼‍♀️', '🚶🏽‍♀️', '🚶🏾‍♀️', '🚶🏿‍♀️',
	'🚶🏻‍♂️', '🚶🏼‍♂️', '🚶🏽‍♂️', '🚶🏾‍♂️', '🚶🏿‍♂️'
]

const productMap = product => {
	if (['nationalExpress', 'nationalExp', 'national'].includes(product)) return 'express'
	if (['regionalExpress', 'regionalExp', 'regional'].includes(product)) return 'regional'
	if (['taxi'].includes(product)) return 'demand-responsive-bus'
	return product
}

const dirArrow = h('abbr', {title: 'in direction of'}, '→')

const setup = (formatTime, formatDelay, actions = {}) => {
	// todo: NOVE_ENV === 'dev'
	if ('function' !== typeof formatTime) {
		throw new Error('formatTime must be a function.')
	}
	if ('function' !== typeof formatDelay) {
		throw new Error('formatDelay must be a function.')
	}

	const renderTime = (d) => {
		return h('time', {
			datetime: d.toISOString()
		}, formatTime(d))
	}

	const pedestrian = pedestrians[Math.floor(Math.random() * pedestrians.length)]

	const renderMode = (leg, i, details) => {
		if (leg.mode === 'walking') {
			const t = new Date(leg.arrival) - new Date(leg.departure)
			const s = [pedestrian, 'walk']
			if (!Number.isNaN(t)) s.push('for', ms(t, {long: true}))
			// todo: distance
			return h('li', {
				className: cls + 'leg ' + cls + 'walking',
				style: {borderLeftColor: '#999'}
			}, [
				h('div', {
					className: cls + 'details'
				}, s.join(' '))
			])
		}
		return renderLine(leg, i, details)
	}

	const renderCycle = (leg) => {
		let res = null
		if (leg.alternatives) {
			let d = Infinity
			for (let a of leg.alternatives) {
				if (a.line.id !== leg.line.id) continue
				const aD = new Date(a.when)
				if (aD < d) d = aD
			}
			res = h('span', {}, [
				'also at ', renderTime(d)
			])
		} else if (leg.cycle && 'number' === typeof leg.cycle.min) {
			const c = leg.cycle
			let msg = 'every ' + ms(c.min * 1000)
			if ('number' === typeof c.max && c.max !== c.min) {
				msg += '–' + ms(c.max * 1000)
			}
			res = h('span', {}, msg)
		}
		return res
	}

	const renderLine = (leg, i, details) => {
		const line = leg.line
		let color = {}
		let symbol = null
		if (line.product) {
			const mappedProduct = productMap(line.product)
			symbol = h('img', {
				className: cls + 'product',
				alt: mappedProduct,
				src: `https://raw.githubusercontent.com/derhuerst/vbb-logos/master/${mappedProduct}.svg?sanitize=true`
			})
			if (line.product === 'taxi') {
				color = { fg: '#000', bg: '#fc0' }
			} else if (products[mappedProduct]) {
				color = {fg: '#fff', bg: products[mappedProduct].color}
				if (mappedProduct === 'express') color.fg = '#000'
			}
		}

		const _stopovers = []
		if (details) {
			for (let stopover of leg.stopovers.slice(1, -1)) {
				_stopovers.push(h('li', {}, renderStopover(stopover.stop, color.bg)))
			}
		}

		const l = leg.stopovers.length
		const label = (l - 1) + ' ' + (l === 2 ? 'stop' : 'stops')

		const nrOfStopovers = leg.stopovers ? h('span', {
			className: cls + 'link',
			'ev-click': details ? () => actions.hideLegDetails(i) : () => actions.showLegDetails(i)
		}, label) : null

		const duration = new Date(leg.arrival) - new Date(leg.departure)

		const cycle = renderCycle(leg)

		let transferPosition = null
		if (details && 'number' === typeof leg.arrivalPosition) {
			transferPosition = h('div', {
				className: cls + 'transfer-position'
			}, [
				renderTransferPosition(leg.arrivalPosition)
			])
		}

		return h('li', {
			className: cls + 'leg',
			style: {
				borderLeftColor: color.bg || '#999'
			}
		}, [
			h('div', {className: cls + 'line-container'}, [
				h('span', {
					className: cls + 'line',
					style: {
						backgroundColor: color.bg || '#555',
						color: color.fg || '#fff'
					}
				}, line.name || '?'),
			]),
			symbol,
			leg.direction ? h('span', {className: cls + 'direction'}, [
				' ', dirArrow, ' ', leg.direction
			]) : null,
			h('div', {
				className: cls + 'details'
			}, flatten([
				h('abbr', {
					title: ms(duration, {long: true})
				}, [
					ms(duration) + ' ride'
				]),
				' · ',
				cycle ? [cycle, ' · '] : [],
				nrOfStopovers,
				transferPosition
			])),
			leg.line && leg.line.product === 'taxi' ? h('button', {
				className: cls + 'checkin-button start',
				value: JSON.stringify({
					tripId: leg.tripId,
					origin: leg.origin.id,
					destination: leg.destination.id,
					lineName: leg.line.name
				})
			}, [
				h('div', { className: cls + 'checkin-button-loading' }, '⌛️'),
				h('div', { className: cls + 'checkin-button-success' }, '✅ Gebucht'),
				h('div', { className: cls + 'checkin-button-fail' }, '❌ Ausgebucht'),
					h('div', { className: cls + 'checkin-button-unknown' }, '📞 Nicht verfügbar'),
				h('div', { className: cls + 'checkin-button-start' }, 'Buchen')
			]) : null,
			_stopovers.length > 0 ? h('ul', {
				className: cls + 'details'
			}, _stopovers) : null
		])
	}

	const selectStop = (stop) => {
		const stationId = stop.station ? stop.station.id : null
		return actions.selectStop(stop.id, stationId)
	}

	const renderStopover = (stop, color) =>
		h('div', {
			className: cls + 'link ' + cls + 'stopover',
			style: {borderBottomColor: color},
			'ev-click': () => selectStop(stop)
		}, stop.name)

	const renderStop = (stop) =>
		h('div', {
			className: cls + 'link',
			'ev-click': () => selectStop(stop)
		}, stop.name)

	const renderStopoverTime = (stop, departure, delay) => {
		const els = [
			h('div', {
				className: cls + 'name'
			}, [renderStop(stop)])
		]

		if ('number' === typeof delay) {
			els.push(h('div', {
				className: cls + 'delay'
			}, [
				formatDelay(delay)
			]))
		}
		departure = new Date(departure)
		if (!Number.isNaN(+departure)) {
			els.splice(1, 0, h('div', {
				className: cls + 'when'
			}, [
				renderTime(departure)
			]))
		}
		return h('li', {
			className: cls + 'stopover'
		}, els)
	}

	const renderJourney = (journey, detailsFor = []) => {
		if (!journey) return null

		const legs = []
		for (let i = 0; i < journey.legs.length; i++) {
			const leg = journey.legs[i]

			legs.push(
				renderStopoverTime(leg.origin, leg.departure, leg.departureDelay),
				renderMode(leg, i, detailsFor.includes(i))
			)

			const nextLeg = journey.legs[i + 1]
			const renderDest = !nextLeg || ( // leg.dest !== nextLeg.origin ?
				leg.destination &&
				nextLeg.origin &&
				nextLeg.origin.id !== leg.destination.id
			)
			if (renderDest) {
				legs.push(renderStopoverTime(leg.destination, leg.arrival, leg.arrivalDelay))
			}
		}

		return h('ul', {
			className: cls + 'journey'
		}, legs)
	}

	return renderJourney
}

module.exports = setup
