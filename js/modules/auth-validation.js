/**
 * Auth validation: disposable email blocklist, honeypot, password strength.
 * Uses blocklist from disposable-email-domains (subset for bundle size).
 */
const DISPOSABLE_DOMAINS = new Set([
    '10minutemail.com', '10minutemail.net', 'tempmail.com', 'tempmail.co', 'guerrillamail.com',
    'guerrillamail.org', 'mailinator.com', 'mailinator.net', 'yopmail.com', 'yopmail.fr',
    'fakeinbox.com', 'throwawaymail.com', 'temp-mail.org', 'getnada.com', 'maildrop.cc',
    'sharklasers.com', 'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de',
    '10minutemail.co.uk', '10minutemail.ga', '10minutemail.ml', '10minutemail.gq',
    'mailinator.org', 'mailinator.us', 'tempmail.net', 'tempmail.io', 'tempail.com',
    'dispostable.com', 'mintemail.com', 'emailondeck.com', 'trashmail.com', 'trashmail.net',
    'mailnesia.com', 'mohmal.com', 'tempinbox.com', 'inboxkitten.com', 'anonymbox.com',
    'spamgourmet.com', 'mailcatch.com', 'mytempmail.com', 'tempmailo.com', 'temp-mail.ru',
    '0-mail.com', '1secmail.com', '1secmail.net', '1secmail.org', '20minutemail.com',
    '33mail.com', '4warding.com', '4warding.net', '4warding.org', '60minutemail.com',
    '675hosting.com', '675hosting.net', '675hosting.org', '6url.com', '75hosting.com',
    '7tags.com', '9ox.net', 'a-bc.net', 'agedmail.com', 'ajaxapp.net', 'amilegit.com',
    'anonbox.net', 'anonmails.de', 'anonymized.org', 'antichef.com', 'antichef.net',
    'antispam.de', 'baxomale.ht.cx', 'beefmilk.com', 'binkmail.com', 'boun.cr',
    'bouncr.com', 'boxformail.in', 'bptfp.net', 'brennendesreich.de', 'bspamfree.org',
    'buffemail.com', 'bugmenot.com', 'bumpymail.com', 'bund.us', 'bundes-li.ga',
    'bunsenhoneydew.com', 'burstmail.info', 'buyusedlibrarybooks.org', 'byom.de',
    'cachedot.net', 'card.zp.ua', 'casualdx.com', 'cek.pm', 'cellurl.com', 'centermail.com',
    'centermail.net', 'chammy.info', 'childsavetrust.org', 'chogmail.com', 'choicemail1.com',
    'clixser.com', 'cmail.net', 'cmail.org', 'coldemail.info', 'consumerriot.com',
    'contrasto.cu.cc', 'cool.fr.nf', 'correo.blogos.net', 'cosmorph.com', 'courriel.fr.nf',
    'courrieltemporaire.com', 'curryworld.de', 'cust.in', 'cuvox.de', 'd3p.dk',
    'dacoolest.com', 'dandikmail.com', 'dayrep.com', 'dbunker.com', 'dcemail.com',
    'deadaddress.com', 'deadspam.com', 'delikkt.de', 'despam.it', 'despammed.com',
    'devnullmail.com', 'dfgh.net', 'digitalsanctuary.com', 'dingbone.com', 'discard.email',
    'discardmail.com', 'discardmail.de', 'disposable.com', 'disposableemailaddresses.com',
    'disposableinbox.com', 'dispose.it', 'disposeamail.com', 'disposemail.com',
    'dispostable.com', 'divermail.com', 'divismail.ru', 'dm.w3internet.co.uk',
    'dodgit.com', 'dodgit.org', 'dodgeit.com', 'dodsi.com', 'doiea.com', 'domozmail.com',
    'donemail.ru', 'dontreg.com', 'dontsendmespam.de', 'dump-email.info', 'dumpandjunk.com',
    'dumpmail.de', 'dumpyemail.com', 'e-mail.com', 'e-mail.org', 'e4ward.com',
    'easytrashmail.com', 'einmalmail.de', 'email60.com', 'emaildienst.de', 'emailgo.de',
    'emailias.com', 'emailigo.de', 'emailinfive.com', 'emaillime.com', 'emailmiser.com',
    'emailsensei.com', 'emailspam.xyz', 'emailtemporanea.com', 'emailtemporanea.net',
    'emailtemporar.ro', 'emailtemporario.com.br', 'emailto.de', 'emailwarden.com',
    'emailxfer.com', 'emailz.cf', 'emeil.in', 'emeil.ir', 'emz.net', 'enterto.com',
    'ephemail.net', 'eqeqeqeqe.tk', 'ero-tube.org', 'evopo.com', 'explodemail.com',
    'express.net.ua', 'extremail.ru', 'eyepaste.com', 'fakeinbox.cf', 'fakeinbox.ga',
    'fakeinbox.info', 'fakeinbox.ml', 'fakeinbox.tk', 'fakedemail.com', 'fakeinformation.com',
    'fansworldwide.de', 'fastacura.com', 'fastchevy.com', 'fastchrysler.com', 'fastkawasaki.com',
    'fastmazda.com', 'fastmitsubishi.com', 'fastnissan.com', 'fastsubaru.com', 'fastsuzuki.com',
    'fasttoyota.com', 'fastyamaha.com', 'fightallspam.com', 'filzmail.com', 'fivemail.de',
    'fixmail.tk', 'fizmail.com', 'flyspam.com', 'footard.com', 'forgetmail.com',
    'fornow.eu', 'fr33mail.info', 'fragolina2.tk', 'frapmail.com', 'friendlymail.co.uk',
    'front14.org', 'fuckingduh.com', 'fudgerub.com', 'fux0ringduh.com', 'garliclife.com',
    'geartower.com', 'gehensie.in', 'get1mail.com', 'get2mail.fr', 'getairmail.com',
    'getmails.eu', 'getonemail.com', 'getsimpleemail.com', 'giantmail.de', 'girlsundertheinfluence.com',
    'gishpuppy.com', 'gmial.com', 'gmil.com', 'go2usa.info', 'go2vpn.net', 'golemico.com',
    'gorillaswithdirtyarmpits.com', 'gotmail.com', 'gotmail.net', 'gotmail.org',
    'gotti.otherinbox.com', 'gowikibooks.com', 'gowikicampus.com', 'gowikicars.com',
    'gowikifilms.com', 'gowikigames.com', 'gowikimusic.com', 'gowikinetwork.com',
    'grandmamail.com', 'grandmasmail.com', 'great-host.in', 'greensloth.com', 'grr.la',
    'gsrv.co.uk', 'guerillamail.biz', 'guerillamail.com', 'guerillamail.net', 'guerillamail.org',
    'guerrillamailblock.com', 'gustr.com', 'harakirimail.com', 'hatena.ne.jp', 'hatespam.org',
    'herp.in', 'hidemail.de', 'hidzz.com', 'hmamail.com', 'hopemail.biz', 'hostcalls.com',
    'hotpop.com', 'hulapla.de', 'ieatspam.eu', 'ieatspam.info', 'ieh-mail.de', 'ihateyoualot.info',
    'iheartspam.org', 'ikbensspamvrij.nl', 'imails.info', 'imgof.com', 'imgv.de',
    'imstations.com', 'inbax.tk', 'inbox.si', 'inboxalias.com', 'inboxclean.com',
    'inboxclean.org', 'incognitomail.com', 'incognitomail.net', 'incognitomail.org',
    'infocom.zp.ua', 'instant-mail.de', 'instantemailaddress.com', 'iozak.com',
    'ip6.li', 'ipoo.org', 'irish2me.com', 'iroid.com', 'ironie.be', 'iwi.net',
    'jetable.com', 'jetable.fr.nf', 'jetable.org', 'jnxjn.com', 'jourrapide.com',
    'jsrsolutions.com', 'kasmail.com', 'kaspop.com', 'kcrw.de', 'keepmymail.com',
    'keinpardon.de', 'kemptvillebaseball.com', 'killmail.com', 'killmail.net', 'kimsdisk.com',
    'kingsq.ga', 'kiois.com', 'klassmaster.com', 'klassmaster.net', 'kloap.com',
    'klzl.com', 'kook.ml', 'kook.ml', 'kulturbetrieb.info', 'kurzepost.de', 'lawlita.com',
    'letthemeatspam.com', 'lez.se', 'lgxscreen.com', 'lifebyfood.com', 'link2mail.net',
    'linkedintuts2016.pw', 'linuxmail.so', 'listomama.com', 'litedrop.com', 'loadby.us',
    'login-email.ml', 'lol.ovh', 'lookugly.com', 'lopl.co.cc', 'lortemail.dk',
    'lovemeleaveme.com', 'lr78.com', 'lroid.com', 'lukop.dk', 'm4ilweb.info',
    'maboard.com', 'mail-easy.com', 'mail-fake.com', 'mail-temporaire.fr', 'mail-temp.com',
    'mail.by', 'mail.mezimages.net', 'mail114.net', 'mail2rss.org', 'mail333.com',
    'mail4trash.com', 'mailbidon.com', 'mailblocks.com', 'mailbucket.org', 'mailcat.biz',
    'mailcatch.com', 'mailde.de', 'mailde.info', 'maildrop.cc', 'maileater.com',
    'mailexpire.com', 'mailfa.tk', 'mailforspam.com', 'mailfree.ga', 'mailfree.gq',
    'mailfree.ml', 'mailfreeonline.com', 'mailfs.com', 'mailguard.me', 'mailhazard.com',
    'mailhazard.us', 'mailhz.me', 'mailimate.com', 'mailin8r.com', 'mailinater.com',
    'mailinator.com', 'mailinator.net', 'mailinator.org', 'mailinator.us', 'mailinator2.com',
    'mailincubator.com', 'mailismagic.com', 'mailjunk.cf', 'mailjunk.ga', 'mailjunk.gq',
    'mailjunk.ml', 'mailjunk.tk', 'mailmate.com', 'mailme.gq', 'mailme.ir', 'mailme.lv',
    'mailme24.com', 'mailmetrash.com', 'mailmoat.com', 'mailnator.com', 'mailnesia.com',
    'mailnull.com', 'mailorg.org', 'mailpick.biz', 'mailproxsy.com', 'mailrock.biz',
    'mailsac.com', 'mailscrap.com', 'mailseal.de', 'mailshell.com', 'mailsiphon.com',
    'mailslapping.com', 'mailslite.com', 'mailspam.xyz', 'mailtemp.info', 'mailtome.de',
    'mailtothis.com', 'mailzilla.com', 'mailzilla.org', 'makemetheking.com', 'manifestgenerator.com',
    'manybrain.com', 'mbx.cc', 'mciek.com', 'mega.zik.dj', 'meinspamschutz.de',
    'meltmail.com', 'messagebeamer.de', 'mezimages.net', 'mierdamail.com', 'migmail.pl',
    'migumail.com', 'mintemail.com', 'mjukgansen.nu', 'moakt.com', 'mobi.web.id',
    'mobileninja.co.uk', 'moburl.com', 'mohmal.com', 'mohmal.in', 'mohmal.tech',
    'momentics.ru', 'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf', 'monumentmail.com',
    'ms9.mailslite.com', 'msg.mailslite.com', 'mspeciosa.com', 'msb.minsmail.com',
    'msg.mailslite.com', 'mspeciosa.com', 'msb.minsmail.com', 'mt2009.com', 'mt2014.com',
    'mt2015.com', 'mx0.wwwnew.eu', 'mxbin.net', 'mxfuel.com', 'my10minutemail.com',
    'mycleaninbox.net', 'myemailboxy.com', 'mymail-in.net', 'mymailoasis.com',
    'mynetstore.de', 'mypartyclip.de', 'myphantomemail.com', 'mysamp.de', 'myspaceinc.com',
    'myspaceinc.net', 'myspacepimpedup.com', 'myspamless.com', 'mytempmail.com',
    'mytrashmail.com', 'nabuma.com', 'nakedtruth.biz', 'nanonym.ch', 'national.shitposting.agency',
    'negated.com', 'neomailbox.com', 'nepwk.com', 'nervmich.net', 'nervt.niet.goed',
    'netmails.com', 'netmails.net', 'netzidiot.de', 'neverbox.com', 'nice-4u.com',
    'nigge.rs', 'nincsmail.com', 'nincsmail.hu', 'nmail.cf', 'nobulk.com', 'noclickemail.com',
    'nodezine.com', 'nospam.ze.tc', 'nospam4.us', 'nospamfor.us', 'nospammail.net',
    'nospamthanks.info', 'notmailinator.com', 'notsharingmy.info', 'nowhere.org',
    'nowmymail.com', 'nurfuerspam.de', 'nus.edu.sg', 'nwldx.com', 'nwldx.net',
    'objectmail.com', 'obobbo.com', 'odnorazovoe.ru', 'ohaaa.de', 'omail.pro',
    'omnievents.org', 'one2mail.info', 'oneoffemail.com', 'onewaymail.com', 'onlatedotcom.info',
    'online.ms', 'onlineidea.info', 'onqin.com', 'ontyne.biz', 'oolus.com',
    'oopi.org', 'opayq.com', 'ordinaryamerican.net', 'oshietechan.link', 'otherinbox.com',
    'ourpreviewdomain.com', 'outlawspam.com', 'ovpn.to', 'owlpic.com', 'ownsyou.de',
    'oxopoha.com', 'pa9e.com', 'pancakemail.com', 'papierkorb.me', 'pastebitch.com',
    'pcusers.otherinbox.com', 'pepbot.com', 'peterdethier.com', 'petlover.com',
    'petml.com', 'pfui.ru', 'photomark.net', 'pi.vu', 'pimpedupmyspace.com',
    'pinehill-seattle.org', 'pingir.com', 'pisls.com', 'pjjkp.com', 'plexolan.de',
    'poczta.onet.pl', 'politikerclub.de', 'poofy.org', 'pookmail.com', 'pop3.xyz',
    'popaccount.com', 'popconn.party', 'popesodomy.com', 'popgx.com', 'popmail.io',
    'popmailserv.org', 'porco.cf', 'porco.ga', 'porco.gq', 'porco.ml', 'postacin.com',
    'postfach2go.de', 'postshift.ru', 'postshift.ru', 'powered.name', 'powlearn.com',
    'pp.ua', 'predatorrat.cf', 'predatorrat.ga', 'predatorrat.gq', 'predatorrat.ml',
    'predatorrat.tk', 'premium-mail.fr', 'primabananen.net', 'privacy.net', 'privatdemail.net',
    'privy-mail.com', 'privymail.de', 'procrackers.com', 'projectcl.com', 'proprietativalcea.ro',
    'propscore.com', 'proxymail.eu', 'proxypage.com', 'prtnx.com', 'prtz.eu',
    'psh.me', 'psles.com', 'psoxs.com', 'punkass.com', 'putthisinyourspamdatabase.com',
    'pwrby.com', 'q314.net', 'q5vm7pi9.com', 'qacquirep.com', 'qisdo.com', 'qisoa.com',
    'quickinbox.com', 'quickmail.nl', 'quickmail.rocks', 'qvap.ru', 'qvy.me', 'qwickmail.com',
    'rainmail.biz', 'rainwaterstudios.org', 'raketenmann.de', 'rancidmouse.net',
    'randomail.net', 'rapt.be', 'raqid.com', 'rax.la', 'raxtest.com', 'reallymymail.com',
    'realtyalerts.ca', 'recode.me', 'recursor.net', 'recyclemail.dk', 'redfeathercrow.com',
    'regbypass.com', 'regbypass.comsafe-mail.net', 're-gister.com', 'rejectmail.com',
    'remail.cf', 'remail.ga', 'remote.li', 'reptilegenetics.com', 'resgedvgfed.tk',
    'revolvingdoorhoax.org', 'rhyta.com', 'rhyta.net', 'rickymail.com', 'riddermark.de',
    'risingsuntouch.com', 'rklips.com', 'rmqkr.net', 'royal.net', 'rppkn.com',
    'rtrtr.com', 'ruffrey.com', 'rumgel.com', 'runi.ca', 'rustydoor.com',
    'rx.dred.ru', 'rx.qc.to', 's0ny.net', 's33db0x.com', 'sabrestlouis.com',
    'sackboii.com', 'safe-mail.net', 'safersignup.de', 'safetymail.info', 'safetypost.de',
    'saharanightstem.com', 'salmeow.tk', 'sandelf.de', 'sandelf.de', 'sandcars.net',
    'sanstr.com', 'sast.ro', 'saynotospams.com', 'scatmail.com', 'schafmail.de',
    'schrott-email.de', 'secretemail.de', 'secure-mail.biz', 'selfip.com', 'sendspamhere.com',
    'server.ms', 'server.ms', 'services391.com', 'sexforsale.top', 'sharklasers.com',
    'shieldedmail.com', 'shieldemail.com', 'shiftmail.com', 'shinnemo.com', 'shipfromto.com',
    'shiphazmat.org', 'shipping-regulations.com', 'shippingterms.org', 'shortmail.net',
    'shotmail.ru', 'shut.name', 'shut.ws', 'sibmail.com', 'sigaret.net', 'sinnlos-mail.de',
    'siteposter.net', 'sixsix.xyz', 'skeefmail.com', 'skypal.net', 'slaskpost.se',
    'slopsbox.com', 'slushmail.com', 'smellfear.com', 'smellrear.com', 'snakemail.com',
    'snapwet.com', 'sneakemail.com', 'sneakmail.de', 'snkmail.com', 'sofimail.com',
    'sofort-mail.de', 'softpls.asia', 'sohu.com', 'sohu.net', 'soisz.com', 'solvemail.info',
    'soodon.com', 'spam4.me', 'spamail.de', 'spamarrest.com', 'spamavert.com',
    'spambob.com', 'spambob.net', 'spambob.org', 'spambog.com', 'spambog.de', 'spambog.net',
    'spambog.ru', 'spambox.info', 'spambox.ir', 'spambox.us', 'spamcannon.com',
    'spamcannon.net', 'spamcero.com', 'spamcon.org', 'spamcorptastic.com', 'spamcowboy.com',
    'spamcowboy.net', 'spamcowboy.org', 'spamday.com', 'spamex.com', 'spamfree.eu',
    'spamfree24.com', 'spamfree24.de', 'spamfree24.eu', 'spamfree24.info', 'spamfree24.net',
    'spamfree24.org', 'spamgoes.in', 'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
    'spamherelots.com', 'spamhereplease.com', 'spamhole.com', 'spamify.com', 'spaminator.de',
    'spamkill.info', 'spaml.com', 'spaml.de', 'spamlot.net', 'spammotel.com', 'spamobox.com',
    'spamoff.de', 'spamslicer.com', 'spamspot.com', 'spamthis.co.uk', 'spamtroll.net',
    'speed.1s.fr', 'spikio.com', 'spoofmail.de', 'squizzy.de', 'ssoia.com',
    'ssl.tls.cloudns.asia', 'startkeys.com', 'stinkefinger.net', 'stop-my-spam.cf',
    'stop-my-spam.com', 'stop-my-spam.ga', 'stop-my-spam.ml', 'stop-my-spam.tk',
    'streetwisemail.com', 'stuffmail.de', 'stumpfwerk.com', 'suburbanthug.com',
    'suckmyd.com', 'sudolife.me', 'sudolife.net', 'sudomail.biz', 'sudomail.com',
    'sudomail.net', 'sudoverse.com', 'sudoverse.net', 'sudoweb.net', 'sudoworld.net',
    'sumaunion.info', 'supergreatmail.com', 'super-auswahl.de', 'superrito.com',
    'superstachel.de', 'suremail.info', 'svk.jp', 'svxr.org', 'sweetxxx.de',
    'swift10minutemail.com', 'tafmail.com', 'tagyourself.com', 'talkinator.com',
    'tapchicuoihoi.com', 'tapchicuoihoi.com', 'tarzan.usa.cc', 'taskforcetech.com',
    'tb-on-line.net', 'tech69.com', 'techemail.com', 'techgroup.me', 'techno5.club',
    'techemail.com', 'techgroup.me', 'techno5.club', 'teerest.com', 'tefl.ro',
    'teleosaurs.xyz', 'teleworm.com', 'teleworm.us', 'temp-mail.best', 'temp-mail.com',
    'temp-mail.org', 'temp-mail.ru', 'temp-mails.com', 'tempail.com', 'tempalias.com',
    'tempe-mail.com', 'tempemail.biz', 'tempemail.co.za', 'tempemail.com', 'tempemail.net',
    'tempinbox.co.uk', 'tempinbox.com', 'tempmail.co', 'tempmail.de', 'tempmail.eu',
    'tempmail.it', 'tempmail.net', 'tempmail2.com', 'tempmaildemo.com', 'tempmailer.com',
    'tempmailer.de', 'tempmailer.net', 'tempmailpro.com', 'tempmails.net', 'tempomail.fr',
    'temporarily.de', 'temporarioemail.com.br', 'temporaryemail.net', 'temporaryemail.us',
    'temporaryforwarding.com', 'temporaryinbox.com', 'temporarymailaddress.com',
    'tempthe.net', 'thanksnospam.info', 'thankyou2010.com', 'thc.st', 'theaviors.com',
    'thelimestrees.com', 'thembones.com.au', 'themostemail.com', 'throam.com',
    'throwaway.email', 'throwawayemailaddress.com', 'throwawaymail.com', 'throya.com',
    'thund.cf', 'thund.ga', 'thund.gq', 'thund.ml', 'thund.tk', 'tiapz.com',
    'tilien.com', 'timgiarevn.com', 'tittbit.in', 'tmailinator.com', 'toiea.com',
    'toomail.biz', 'topranklist.de', 'tormail.org', 'toss.pw', 'totalvista.com',
    'totesmail.com', 'tp-qa-mail.com', 'tradermail.info', 'trash-amil.com',
    'trash-mail.at', 'trash-mail.com', 'trash-mail.de', 'trash-mail.ga', 'trash-mail.gq',
    'trash-mail.ml', 'trash-mail.tk', 'trash2009.com', 'trash2010.com', 'trash2011.com',
    'trashbox.eu', 'trashdevil.com', 'trashdevil.de', 'trashdevil.net', 'trashdevil.org',
    'trashemail.de', 'trashemails.de', 'trashmail.at', 'trashmail.com', 'trashmail.de',
    'trashmail.ga', 'trashmail.gq', 'trashmail.io', 'trashmail.me', 'trashmail.net',
    'trashmail.org', 'trashmail.ws', 'trashmailer.com', 'trashymail.com', 'trashymail.net',
    'trbvm.com', 'trbvm.com', 'trickmail.net', 'trillianpro.com', 'tryalert.com',
    'tryninja.io', 'ttirv.com', 'turoid.com', 'turual.com', 'tvchd.com',
    'tverya.com', 'twitch.gives', 'twkly.ml', 'twocowmail.net', 'twoweirdtricks.com',
    'txrsquared.xyz', 'tyldd.com', 'u14269.ml', 'u2club.com', 'u6lvty2.com',
    'ua3jx7n0msb.cf', 'ubm.md', 'ucansuc.pw', 'uggsrock.com', 'uguuchantele.com',
    'uhhu.ru', 'uiu.us', 'ultra.fyi', 'umail.net', 'undo.it', 'uni.me',
    'unids.com', 'unlimit.com', 'unmail.ru', 'upliftnow.com', 'uplipht.com',
    'uploadnoir.com', 'urfunktion.de', 'uroid.com', 'us.af', 'us.to',
    'used-product.fr', 'username.e4ward.com', 'ushijima1129.tk', 'utiket.us',
    'uu.gl', 'uwork4.us', 'vaasfc4.tk', 'valemail.net', 'valhalladev.com',
    'venompen.com', 'verdejo.com', 'veryday.ch', 'veryday.eu', 'veryday.info',
    'veryrealemail.com', 'vesa.pw', 'vfemail.net', 'vickaent.tk', 'viditag.com',
    'viewcastmedia.com', 'viewcastmedia.net', 'viewcastmedia.org', 'vikingsonly.com',
    'vinernet.com', 'vip.163.com', 'vip.188.com', 'vip.qq.com', 'vip.126.com',
    'vip.21cn.com', 'vip.citiz.net', 'vip.eyou.com', 'vip.sina.com', 'vip.sohu.com',
    'vip.sohu.net', 'vip.163.com', 'vip.188.com', 'vip.qq.com', 'vip.126.com',
    'viralplays.com', 'vkcode.ru', 'vmani.com', 'vmpanda.com', 'vnedu.com',
    'vomoto.com', 'vpn.st', 'vpn33.top', 'vps30.com', 'vps911.com', 'vradportal.com',
    'vssms.com', 'vtxmail.com', 'vubby.com', 'vuiy.pw', 'vzlom4ik.tk',
    'w3internet.co.uk', 'w4i3em6r.com', 'w918bsq.com', 'wasteland.rfc822.org',
    'watch-harry-potter.com', 'watchever.biz', 'watchfull.net', 'watchmail.net',
    'wazabi.club', 'webemail.me', 'webm4il.info', 'webuser.in', 'wee.my',
    'wefjo.gq', 'weg-werf-email.de', 'wegwerf-email-addressen.de', 'wegwerf-emails.de',
    'wegwerfadresse.de', 'wegwerfemail.com', 'wegwerfemail.de', 'wegwerfemail.info',
    'wegwerfemail.net', 'wegwerfemail.org', 'wegwerfemailadresse.com', 'wegwerfmail.de',
    'wegwerfmail.info', 'wegwerfmail.net', 'wegwerfmail.org', 'wegwerpmailadres.nl',
    'weirdseed.com', 'welikecookies.com', 'wemel.top', 'wetrainbayarea.com',
    'wetrainbayarea.org', 'wfgdfhj.tk', 'whatiaas.com', 'whatpaas.com', 'whatsaas.com',
    'whopy.com', 'whtjddn.33mail.com', 'whyspam.me', 'wibblesmith.com', 'wickmail.net',
    'widget.gg', 'wierie.tk', 'wilemail.com', 'willhackforfood.biz', 'willselfdestruct.com',
    'wimsg.com', 'winemaven.info', 'wolfsmail.tk', 'wolfsmail.tk', 'writeme.com',
    'wronghead.com', 'writeme.com', 'wronghead.com', 'wuzup.net', 'wuzupmail.net',
    'www.e4ward.com', 'www.gishpuppy.com', 'www.mailinator.com', 'wwwnew.eu',
    'wxnw.net', 'x24.com', 'xag.co', 'xag.co.uk', 'xcompress.com', 'xcpy.com',
    'xents.com', 'x.ip6.li', 'xmail.com', 'xmail.net', 'xmaily.com', 'xn--9kq967o.com',
    'xoxy.net', 'xperiae5.com', 'xrho.com', 'xwaretech.com', 'xwaretech.info',
    'xwaretech.net', 'xww.ro', 'xy9ce.tk', 'xyzfree.net', 'yapped.net',
    'ycare.de', 'ycn.ro', 'ye.vc', 'yep.it', 'yogamaven.com', 'yopmail.com',
    'yopmail.fr', 'yopmail.gq', 'yopmail.net', 'yopmail.pp.ua', 'yourdomain.com',
    'yourspamgoesto.space', 'yourtube.ml', 'ypmail.webarnak.fr.eu.org', 'yroid.com',
    'yspend.com', 'ytpayy.com', 'yugasandrika.com', 'yui.it', 'yuurok.com',
    'z1p.biz', 'z86.ru', 'zainmax.net', 'zaktouni.fr', 'ze.gally.jp',
    'zehnminuten.de', 'zehnminutenmail.de', 'zehnminutenmail.de', 'zehnminutenmail.net',
    'zehnminutenmail.org', 'zehnminutenmail.de', 'zehnminutenmail.net', 'zehnminutenmail.org',
    'zetmail.com', 'zfymail.com', 'zhaoyuanedu.cn', 'zhcne.com', 'zhewei.xyz',
    'zhorachu.com', 'ziggo.nl', 'zipcad.com', 'zipmail.fr', 'zipmail.fr.nf',
    'zippymail.info', 'zippymail.net', 'zipsendit.com', 'zoaxe.com', 'zoemail.com',
    'zoemail.net', 'zoemail.org', 'zoetropes.org', 'zomg.info', 'zumpul.com',
    'zxcv.com', 'zxcvbnm.com', 'zxcvbnm.tk', 'zymuying.com', 'zzi.us', 'zzz.com'
]);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const RATE_LIMIT_DEFAULTS = {
    signup: { key: 'millads_signup_attempts', windowMs: 60 * 60 * 1000, max: 5 },
    signin: { key: 'millads_signin_attempts', windowMs: 60 * 60 * 1000, max: 10 },
    passwordReset: { key: 'millads_pwreset_attempts', windowMs: 60 * 60 * 1000, max: 5 },
};

function getDomain(email) {
    const at = email.lastIndexOf('@');
    return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

export function isDisposableEmail(email) {
    const domain = getDomain(email);
    return domain && DISPOSABLE_DOMAINS.has(domain);
}

export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (trimmed.length > 254) return false;
    return EMAIL_REGEX.test(trimmed);
}

export function isStrongPassword(password) {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 8) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    return hasLetter && hasNumber;
}

export function getPasswordErrors(password) {
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter.';
    if (!/\d/.test(password)) return 'Password must contain at least one number.';
    return null;
}

export function checkHoneypot(value) {
    return !!(value && String(value).trim().length > 0);
}

function checkRateLimitGeneric(storageKey, windowMs, max, label) {
    try {
        const raw = localStorage.getItem(storageKey);
        const data = raw ? JSON.parse(raw) : { count: 0, firstAt: Date.now() };
        const now = Date.now();
        if (now - data.firstAt > windowMs) {
            data.count = 0;
            data.firstAt = now;
        }
        if (data.count >= max) {
            const minutesLeft = Math.ceil((windowMs - (now - data.firstAt)) / 60000);
            return { allowed: false, message: `Too many ${label} attempts. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.` };
        }
        data.count++;
        localStorage.setItem(storageKey, JSON.stringify(data));
        return { allowed: true };
    } catch {
        return { allowed: true };
    }
}

export function checkRateLimit() {
    const { key, windowMs, max } = RATE_LIMIT_DEFAULTS.signup;
    return checkRateLimitGeneric(key, windowMs, max, 'signup');
}

export function checkSignInRateLimit() {
    const { key, windowMs, max } = RATE_LIMIT_DEFAULTS.signin;
    return checkRateLimitGeneric(key, windowMs, max, 'sign-in');
}

export function checkPasswordResetRateLimit() {
    const { key, windowMs, max } = RATE_LIMIT_DEFAULTS.passwordReset;
    return checkRateLimitGeneric(key, windowMs, max, 'password reset');
}
