import React, { useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, Image, TouchableOpacity, InteractionManager } from 'react-native';
import { NavigationContext } from 'react-navigation';
import { connect } from 'react-redux';
import NotificationManager from '../../../../core/NotificationManager';
import Device from '../../../../util/Device';
import Logger from '../../../../util/Logger';
import { setLockTime } from '../../../../actions/settings';
import { strings } from '../../../../../locales/i18n';
import { getNotificationDetails } from '..';

import {
	useWyreTerms,
	useWyreRates,
	useWyreApplePay,
	WyreException,
	WYRE_IS_PROMOTION,
	WYRE_FEE_PERCENT
} from '../orderProcessor/wyreApplePay';

import ScreenView from '../components/ScreenView';
import { getPaymentMethodApplePayNavbar } from '../../Navbar';
import AccountBar from '../components/AccountBar';
import Keypad, { Keys } from '../../../Base/Keypad';
import Text from '../../../Base/Text';
import StyledButton from '../../StyledButton';
import { colors, fontStyles } from '../../../../styles/common';
import { protectWalletModalVisible } from '../../../../actions/user';

//* styles and components  */

const styles = StyleSheet.create({
	screen: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	amountContainer: {
		margin: Device.isIphone5() ? 0 : 10,
		padding: Device.isMediumDevice() ? (Device.isIphone5() ? 5 : 10) : 15,
		alignItems: 'center',
		justifyContent: 'center'
	},
	amount: {
		...fontStyles.light,
		color: colors.black,
		fontSize: Device.isIphone5() ? 48 : 48,
		height: Device.isIphone5() ? 50 : 60
	},
	amountError: {
		color: colors.red
	},
	content: {
		flexGrow: 1,
		justifyContent: 'space-around'
	},
	quickAmounts: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-around',
		marginHorizontal: 70
	},
	quickAmount: {
		borderRadius: 18,
		borderColor: colors.grey200,
		borderWidth: 1,
		paddingVertical: 5,
		paddingHorizontal: 8,
		alignItems: 'center',
		minWidth: 49
	},
	quickAmountSelected: {
		backgroundColor: colors.blue,
		borderColor: colors.blue
	},
	quickAmountSelectedText: {
		color: colors.white
	},
	buttonContainer: {
		paddingBottom: 20
	},
	applePayButton: {
		backgroundColor: colors.black,
		padding: 10,
		margin: Device.isIphone5() ? 5 : 10,
		marginHorizontal: 25,
		alignItems: 'center'
	},
	applePayButtonText: {
		color: colors.white
	},
	applePayButtonContentDisabled: {
		opacity: 0.6
	},
	applePayLogo: {
		marginLeft: 4
	}
});

/* eslint-disable import/no-commonjs */
const ApplePayLogo = require('../../../../images/ApplePayLogo.png');
const ApplePay = ({ disabled }) => (
	<Image source={ApplePayLogo} style={[styles.applePayLogo, disabled && styles.applePayButtonContentDisabled]} />
);

ApplePay.propTypes = {
	disabled: PropTypes.bool
};

const QuickAmount = ({ amount, current, ...props }) => {
	const selected = amount === current;
	return (
		<TouchableOpacity style={[styles.quickAmount, selected && styles.quickAmountSelected]} {...props}>
			<Text bold={selected} style={[selected && styles.quickAmountSelectedText]}>
				${amount}
			</Text>
		</TouchableOpacity>
	);
};

QuickAmount.propTypes = {
	amount: PropTypes.string,
	current: PropTypes.string
};

//* Constants */

const quickAmounts = ['50', '100', '250'];
const minAmount = 50;
const maxAmount = 250;

const hasZeroAsFirstDecimal = /^\d+\.0$/;
const hasZerosAsDecimals = /^\d+\.00$/;
const hasPeriodWithoutDecimal = /^\d+\.$/;

function PaymentMethodApplePay({
	lockTime,
	setLockTime,
	selectedAddress,
	network,
	addOrder,
	protectWalletModalVisible
}) {
	const navigation = useContext(NavigationContext);
	const [amount, setAmount] = useState('0');
	const roundAmount =
		hasZerosAsDecimals.test(amount) || hasZeroAsFirstDecimal.test(amount) || hasPeriodWithoutDecimal.test(amount)
			? amount.split('.')[0]
			: amount;
	const isUnderMinimum = (amount !== '0' || Number(roundAmount) !== 0) && Number(roundAmount) < minAmount;

	const isOverMaximum = Number(roundAmount) > maxAmount;
	const disabledButton = amount === '0' || isUnderMinimum || isOverMaximum;

	const handleWyreTerms = useWyreTerms(navigation);
	const rates = useWyreRates(network, 'USDETH');
	const [pay, ABORTED, , , , fee] = useWyreApplePay(roundAmount, selectedAddress, network);

	const handlePressApplePay = useCallback(async () => {
		const prevLockTime = lockTime;
		setLockTime(-1);
		try {
			const order = await pay();
			if (order !== ABORTED) {
				if (order) {
					addOrder(order);
					navigation.dismiss();
					protectWalletModalVisible();
					InteractionManager.runAfterInteractions(() =>
						NotificationManager.showSimpleNotification(getNotificationDetails(order))
					);
				} else {
					Logger.error('FiatOrders::WyreApplePayProcessor empty order response', order);
				}
			}
		} catch (error) {
			NotificationManager.showSimpleNotification({
				duration: 5000,
				title: strings('fiat_on_ramp.notifications.purchase_failed_title', {
					currency: 'ETH'
				}),
				description: `${error instanceof WyreException ? 'Wyre: ' : ''}${error.message}`,
				status: 'error'
			});
			Logger.error(error, 'FiatOrders::WyreApplePayProcessor Error');
		} finally {
			setLockTime(prevLockTime);
		}
	}, [ABORTED, addOrder, lockTime, navigation, pay, setLockTime, protectWalletModalVisible]);

	const handleQuickAmountPress = useCallback(amount => setAmount(amount), []);
	const handleKeypadChange = useCallback(
		(value, key) => {
			if (isOverMaximum && key !== Keys.BACK) {
				return;
			}
			if (value === amount) {
				return;
			}

			setAmount(value);
		},
		[amount, isOverMaximum]
	);

	return (
		<ScreenView contentContainerStyle={styles.screen}>
			<View>
				<AccountBar />
				<View style={styles.amountContainer}>
					<Text
						title
						style={[styles.amount, isOverMaximum && styles.amountError]}
						numberOfLines={1}
						adjustsFontSizeToFit
					>
						${amount}
					</Text>
					{!(isUnderMinimum || isOverMaximum) &&
						(rates ? (
							<Text>
								{roundAmount === '0' ? (
									`$${rates.USD.toFixed(2)} ??? 1 ETH`
								) : (
									<>
										{strings('fiat_on_ramp.wyre_estimated', {
											currency: 'ETH',
											amount: (amount * rates.ETH).toFixed(5)
										})}
									</>
								)}
							</Text>
						) : (
							<Text>{strings('fiat_on_ramp.wyre_loading_rates')}</Text>
						))}
					{isUnderMinimum && (
						<Text>{strings('fiat_on_ramp.wyre_minimum_deposit', { amount: `$${minAmount}` })}</Text>
					)}
					{isOverMaximum && (
						<Text style={styles.amountError}>
							{strings('fiat_on_ramp.wyre_maximum_deposit', { amount: `$${maxAmount}` })}
						</Text>
					)}
				</View>
				{quickAmounts.length > 0 && (
					<View style={styles.quickAmounts}>
						{quickAmounts.map(quickAmount => (
							<QuickAmount
								key={quickAmount}
								amount={quickAmount}
								current={roundAmount}
								// eslint-disable-next-line react/jsx-no-bind
								onPress={() => handleQuickAmountPress(quickAmount)}
							/>
						))}
					</View>
				)}
			</View>
			<View style={styles.content}>
				<Keypad currency="usd" onChange={handleKeypadChange} value={amount} />
				<View style={styles.buttonContainer}>
					<StyledButton
						type="blue"
						disabled={disabledButton}
						containerStyle={styles.applePayButton}
						onPress={handlePressApplePay}
					>
						<Text
							centered
							bold
							style={[styles.applePayButtonText, disabledButton && styles.applePayButtonContentDisabled]}
						>
							{strings('fiat_on_ramp.buy_with')}
						</Text>
						<ApplePay disabled={disabledButton} />
					</StyledButton>
					<Text centered>
						{WYRE_IS_PROMOTION && (
							<Text>
								{WYRE_FEE_PERCENT}% {strings('fiat_on_ramp.fee')} (
								{strings('fiat_on_ramp.limited_time')})
							</Text>
						)}
						{!WYRE_IS_PROMOTION && (
							<>
								{disabledButton ? (
									<Text>
										<Text bold> </Text>
									</Text>
								) : (
									<Text>
										<Text bold>{strings('fiat_on_ramp.plus_fee', { fee: `$${fee}` })}</Text>
									</Text>
								)}
							</>
						)}
					</Text>
					<TouchableOpacity onPress={handleWyreTerms}>
						<Text centered link>
							{strings('fiat_on_ramp.wyre_terms_of_service')}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</ScreenView>
	);
}

PaymentMethodApplePay.propTypes = {
	/**
	 * Current time to lock screen set in settings
	 */
	lockTime: PropTypes.number.isRequired,
	/**
	 * Function to change lock screen time setting
	 */
	setLockTime: PropTypes.func.isRequired,
	/**
	 * Currently selected wallet address
	 */
	selectedAddress: PropTypes.string.isRequired,
	/**
	 * Currently selected network
	 */
	network: PropTypes.string.isRequired,
	/**
	 * Function to dispatch adding a new fiat order to the state
	 */
	addOrder: PropTypes.func.isRequired,
	/**
	 * Prompts protect wallet modal
	 */
	protectWalletModalVisible: PropTypes.func
};

PaymentMethodApplePay.navigationOptions = ({ navigation }) => getPaymentMethodApplePayNavbar(navigation);

const mapStateToProps = state => ({
	lockTime: state.settings.lockTime,
	selectedAddress: state.engine.backgroundState.PreferencesController.selectedAddress,
	network: state.engine.backgroundState.NetworkController.network
});

const mapDispatchToProps = dispatch => ({
	setLockTime: time => dispatch(setLockTime(time)),
	addOrder: order => dispatch({ type: 'FIAT_ADD_ORDER', payload: order }),
	protectWalletModalVisible: () => dispatch(protectWalletModalVisible())
});
export default connect(
	mapStateToProps,
	mapDispatchToProps
)(PaymentMethodApplePay);
