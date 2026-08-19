1. in th consumer app when clicking in the add to bag it shows a notification of select size but use dont know if he have to add to bag or what to do open a modal in center please select side then use can select size and add to bad and then show the modal in center added to bag auto matically closed fix this and also when adding in back its showing the niumber sin bottom bag but not showing inthe top rigth bag qhwn opeing the product detail page there in top rigth bag cards not wihtg the numbers fix this 

2. for th coupons in the product edtail open a modal from bottom to show the coupon informations when  and where its aplications the coupon right now itsnot clickable and not working fix this also 

3. in buy now review order page its showing next day in try and buy try and buy do not show next day give the terms and conditions in one line remove the mdashes and and add some syunbol iun try andbuy line thatsit is prepade 

4. the content in the modal that is appering from the bottom fo rthe terms and conditions the content in bottom is being cut and moving out o fth esafe area 

5. if the couoins are not avaikabke remove the hardcoded coupkns fetch the coupons and all from the backend only giving you the endpoint and the view coupons in reviw is nit visbke its showing empty there ll coupon should be visible in view coupon is its valid 

6. in the categroy for each category there are diffrent categories so when opeing any oine oin top itsshowing all the other options it should not show all other things only show subcategories relted to prodct i have opened like its showing al prodcut in top below the hero in category page fix this 

7. in list view in categores add shot descriptions or somtihng as the list is empty right now fully there is alot of epty space fix this 

8. try and buy when clicking the modal is not opeing for loging in fi xthis also if use is not logied in the try and by should not opein and ask for loking ad then after login only it should work 

9. in try and buy page give options for sort filter men woment like on other pages right now there are just products places

10. remove the genter swithc from the product categories and othe rplaces it should only be ther ein home in categories 

11. fix the ui for the appy coupon button iots judst showing appied fix the ui for this

12. if showing the notifications in bottom as the nav menu is not there then show the notification in bottom there should be no gaps there is nav bar is not there the notificsiton should be showing in bottom sticked 

13. in the bag its showing diffrent prices do not use anything static do not show diffrent charges or hard coded only use the backend data if you donthave end point tell me ill shre in the bag hsowing diffrent delivery and in review check out its showing diffrent 

14. in the bag and review order ui are too diffrent make same like the price and otehr things showing are too difrent and the couipon ppliued in bag is not showing i nthe review i have to aghain apply in the review page fix this the discound loking green in bag in review its diffrent redesign the revie page like bag type 

15. remvoe the 2-3 days add try and buy there there is not standard deilvery there is only express tryand buy and in store pickup 

16. in the bag top right for the products preview in the bag page there are showing multiple products make the ui for thst more better improve the ui more aesthetic and better and easy to understnd 

17. flash fit page the fit is already added but its still showing add the fit show somthing like already aded or some tick mark 

end points 
Listing coupons

GET /api/v1/promotions/active — public, no auth.

Returns live offer and coupon promotions, already filtered to status='active', inside their validity window, and not fully redeemed. For a coupon the code is the promotion's name (so NEWVIBE is both the name and what the shopper types).

{ "id": "...", "code": "NEWVIBE", "name": "NEWVIBE", "mechanism": "coupon",
  "discountType": "flat_amount", "appliedTo": "coupon",
  "config": { "amountPaise": 50000 }, "storeId": null, "validUntil": "..." }

GET /api/v1/consumer/rewards — requires a consumer token.

This is the one you need for the four codes in your DB. /promotions/active deliberately excludes vouchers, because a voucher is issued to one person — so 46ZA6569 will never appear there. Personal vouchers come from here.

Verifying / applying a code

There is no separate validate endpoint, by design. Codes flow through the pricing engine so there's one source of truth:

POST /api/v1/pricing/cart — public, optional auth (a consumer token enriches it with loyalty/wallet eligibility).

{ "items": [{ "variantId": "...", "qty": 1 }],
  "couponCode": "NEWVIBE",
  "voucherCode": "46ZA6569",
  "deliveryMethod": "standard",
  "paymentMethod": "upi" }

POST /api/v1/pricing/quote — same, single-store, additionally takes storeId and addressId.

Applying and verifying are the same call. The response carries the discount if it applied, and rejectedCodes if it didn't:

"rejectedCodes": [{ "code": "NEWVIBE", "kind": "coupon", "reason": "expired" }]

A bad code never throws — the cart simply prices without it, so you render the rejection inline rather than handling an error.

Reasons you can branch on: not_found, inactive, expired, fully_redeemed, first_order_only, tier_ineligible, per_consumer_limit_reached.

Two things worth knowing:

couponCode and voucherCode are separate fields — a voucher code sent as couponCode comes back not_found. Your four DB codes are vouchers, so they go in voucherCode.

To show "which coupons can I use right now" with real eligibility, you have to call /pricing/cart with the cart — /promotions/active only tells you what exists. Eligibility depends on cart contents, store scope, first-order status and loyalty tier, none of which the list endpoint can know. The usual pattern is: list from /promotions/active + /consumer/rewards, then price the cart with the chosen code and show rejectedCodes if it bounces.


if kisi or chiz ka choye end point to mang lena sharmana mat 