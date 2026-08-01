<?php
include("proxyConnector.class.php");

function removeLastChars($string) {
    return substr($string, 0, -3);
}

while(true) {


$servername = "10.20.10.115";
$username = "scraper";
$password = "5Kql8p7h2025!";
$dbname = "scraper";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
} 


    //list of browsers
        $agentBrowser = array(
                'Firefox',
                'Safari',
                'Opera',
                'Flock',
                'Edge',
                'Seamonkey',
                'Konqueror',
                'GoogleBot'
        );
        //list of operating systems
        $agentOS = array(
                'Windows 98',
                'Windows 2000',
                'Windows NT',
                'Windows XP',
                'Windows Vista',
                'Redhat Linux',
                'Ubuntu',
                'Fedora',
                'AmigaOS',
                'OS 10.9',
				'OS 10.10',
				'OS 10.11',
				'OS 10.12',
				'OS 10.13',
				'OS 10.14',
				'OS 10.15'
        );
        //randomly generate UserAgent
        $userAgentrand = $agentBrowser[rand(0,7)].'/'.rand(1,8).'.'.rand(0,9).' (' .$agentOS[rand(0,11)].' '.rand(1,7).'.'.rand(0,9).'; de-DE;)';
        $userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    
    $torproxy = proxyConnector::getIstance();		
    $torproxy->launch("http://www.whatsmyip.com", null);
	$cycleIP = $torproxy->getProxyData();
	
	$torSocks5Proxy = "socks5://127.0.0.1:9050";
	
	$ch8 = curl_init();
	$path_cookie = 'cookie.txt';
	
	//curl_setopt ($ch8, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS5_HOSTNAME );
	//curl_setopt ($ch8, CURLOPT_PROXY, $torSocks5Proxy );
	curl_setopt ($ch8 ,CURLOPT_USERAGENT, $userAgent);
	curl_setopt ($ch8, CURLOPT_URL, "https://data.swissgrid.ch/charts/frequency");
    curl_setopt ($ch8, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt ($ch8, CURLOPT_COOKIESESSION, true);
	curl_setopt ($ch8, CURLOPT_COOKIEJAR, realpath($path_cookie));
    curl_setopt ($ch8, CURLOPT_FOLLOWLOCATION, 1);
	$header[0] = "Accept: application/json,";
	$header[0] .= "*/*;q=0.5";
	$header[] = "Accept-Charset: ISO-8859-1,utf-8;q=0.7,*;q=0.7";
	$header[] = "Accept-Language: de-de,de;q=0.5";
	curl_setopt($ch8, CURLOPT_HTTPHEADER, $header);
	curl_setopt($ch8, CURLOPT_ENCODING, 'gzip');
    
	$json1 = curl_exec($ch8);


    $json = json_decode($json1, true);
    
    $curtime = removeLastChars($json["data"]["series"][0]["data"][58][0]);
    $datatime = $json["data"]["table"][6]["value"];
    $freqplan1 = "50.00";
    $freqact1 = $json["table"][0]["value"];
    $freqdelta1 = "-0.011000";
    $gridtimedev1 = $json["table"][1]["value"];
    
    $intakedate = date('Y-m-d H:i:s', $curtime);
    $intakedate1 = date('Y-m-d H:i:s',strtotime("-1 hour", $curtime));
    //$intakedate1 = date('Y-m-d H:i:s', strtotime('+1 hour'));
    $freqplan = substr($freqplan1, 0, -3);
    $freqact = substr($freqact1, 0, -3);
    $freqdelta = substr($freqdelta1, 0, -3);
    $gridtimedev = substr($gridtimedev1, 0, -2);
    
    //echo $url;
    
    //echo $json1;
    
    //echo $curtime. "<br>";
    
    echo $intakedate. "<br>";
    echo $intakedate1."<br>";
    echo $freqplan."<br>";
    echo $freqact."<br>";
    echo $freqdelta."<br>";
    echo $gridtimedev."<br>";
    
    
    if(!empty($freqact)) {
    $sql = "INSERT INTO netzdaten_chronik (curtime, datatime, freqplan, freqact, freqdelta, gridtimedev, intracompdate, 15mincompdate, 60mincompdate)
VALUES ('$intakedate', '$intakedate1', '$freqplan', '$freqact', '$freqdelta', '$gridtimedev', '0000-00-00 00:00:00', '0000-00-00 00:00:00', '0000-00-00 00:00:00')";

    if ($conn->query($sql) === TRUE) {
      
      
  
} else {
 
}

        
    }
    
    //$json1->clear();
    unset($json1);
	curl_close($ch8);
	exit();

sleep(10);
}

?>